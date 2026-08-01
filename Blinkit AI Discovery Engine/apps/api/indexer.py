import os
import sqlite3
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

import database
import vector_store

load_dotenv()

_model = None

def get_model():
    """
    Lazily loads the local BGE-small embedding model on CPU.
    """
    global _model
    if _model is None:
        model_name = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")
        print(f"Loading local embedding model: {model_name} ...")
        # Load model locally
        _model = SentenceTransformer(model_name)
    return _model

def get_query_embedding(query_text: str) -> List[float]:
    """
    Generates an embedding for a query using BGE's recommended instruction prefix.
    """
    model = get_model()
    # BGE-small instructions for queries: prefix is required for asymmetric search
    instruction = "Represent this sentence for searching relevant passages: "
    embedding = model.encode(instruction + query_text, normalize_embeddings=True)
    return embedding.tolist()

def get_document_embeddings(doc_texts: List[str]) -> List[List[float]]:
    """
    Generates embeddings for a list of document chunks (no prefix needed for corpus).
    """
    if not doc_texts:
        return []
    model = get_model()
    embeddings = model.encode(doc_texts, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()

def build_review_chunk(row: Dict[str, Any]) -> str:
    """
    Aggregates review text and metadata into a structured document text block.
    """
    review = row.get("review") or ""
    problem = row.get("problem") or "None"
    pain_point = row.get("pain_point") or "None"
    persona = row.get("user_persona") or "None"
    barrier = row.get("barrier_to_new_category") or "None"
    area = row.get("product_area") or "None"
    
    chunk = (
        f"Review: {review}\n"
        f"Problem: {problem}\n"
        f"Pain Point: {pain_point}\n"
        f"Persona: {persona}\n"
        f"Barrier: {barrier}\n"
        f"Product Area: {area}"
    )
    return chunk

def get_sqlite_reviews() -> List[Dict[str, Any]]:
    """
    Fetches all reviews from SQLite as dictionaries.
    """
    conn = database.get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT review_id, review, problem, pain_point, product_area, 
               shopping_goal, barrier_to_new_category, user_persona, 
               emotion, frequency, priority, recommended_action
        FROM reviews
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def index_delta_reviews() -> dict:
    """
    Reconciles SQLite reviews with Chroma vector store. 
    Computes local embeddings for new reviews, and deletes orphaned vector records.
    """
    print("Reconciling vector index with SQLite database...")
    
    # 1. Fetch all SQLite review records
    sqlite_reviews = get_sqlite_reviews()
    sqlite_ids = {r["review_id"] for r in sqlite_reviews}
    
    # 2. Fetch all existing IDs in Chroma collection
    existing_chroma_ids = set(vector_store.collection.get(include=[])["ids"])
    
    # 3. Identify inserts/deletes
    ids_to_add = sqlite_ids - existing_chroma_ids
    ids_to_delete = existing_chroma_ids - sqlite_ids
    
    # Process deletions
    if ids_to_delete:
        print(f"Deleting {len(ids_to_delete)} orphaned records from Chroma index...")
        vector_store.delete_documents(list(ids_to_delete))
        
    # Process insertions
    added_count = 0
    if ids_to_add:
        print(f"Embedding and indexing {len(ids_to_add)} new reviews...")
        reviews_to_index = [r for r in sqlite_reviews if r["review_id"] in ids_to_add]
        
        # Batch processing (batch size: 32)
        batch_size = 32
        for i in range(0, len(reviews_to_index), batch_size):
            batch = reviews_to_index[i:i+batch_size]
            
            ids = [r["review_id"] for r in batch]
            documents = [build_review_chunk(r) for r in batch]
            
            # Map clean metadata fields (Chroma does not support nested dicts, 
            # and prefers simple strings, ints, floats, or bools)
            metadatas = []
            for r in batch:
                m = {
                    "review_id": r["review_id"],
                    "product_area": r["product_area"] or "None",
                    "user_persona": r["user_persona"] or "None",
                    "barrier_to_new_category": r["barrier_to_new_category"] or "None",
                    "priority": r["priority"] or "None",
                    "frequency": r["frequency"] or "None",
                    "emotion": r["emotion"] or "None"
                }
                metadatas.append(m)
                
            embeddings = get_document_embeddings(documents)
            vector_store.upsert_documents(ids, embeddings, documents, metadatas)
            added_count += len(batch)
            print(f"Indexed batch: {added_count}/{len(reviews_to_index)}")

    total_count = vector_store.get_collection_count()
    print(f"Vector index sync complete. Total vectors in index: {total_count}")
    return {
        "ok": True,
        "added": added_count,
        "deleted": len(ids_to_delete),
        "total": total_count
    }

def rebuild_index() -> dict:
    """
    Clears Chroma index and vectorizes all SQLite reviews fresh.
    """
    print("Rebuilding Chroma vector collection...")
    # Delete all items in collection
    existing_ids = vector_store.collection.get(include=[])["ids"]
    if existing_ids:
        vector_store.delete_documents(existing_ids)
        
    return index_delta_reviews()

if __name__ == "__main__":
    import time
    start = time.time()
    res = index_delta_reviews()
    print(f"Index run complete in {time.time() - start:.2f} seconds. Details: {res}")
