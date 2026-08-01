import os
import chromadb
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

# Find project root (three levels up from vector_store.py if vector_store.py is in apps/api/)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment configurations
load_dotenv(dotenv_path=os.path.join(os.path.dirname(CURRENT_DIR), ".env")) # apps/.env if exists
load_dotenv(dotenv_path=os.path.join(CURRENT_DIR, ".env")) # apps/api/.env

raw_chroma_path = os.getenv("CHROMA_PERSIST_PATH", "./data/chroma")
if os.path.isabs(raw_chroma_path):
    CHROMA_PATH = raw_chroma_path
else:
    CHROMA_PATH = os.path.abspath(os.path.join(ROOT_DIR, raw_chroma_path))

# Initialize local ChromaDB client
print(f"Initializing ChromaDB Client at: {CHROMA_PATH}")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(name="blinkit_reviews")

def upsert_documents(ids: List[str], embeddings: List[List[float]], documents: List[str], metadatas: List[Dict[str, Any]]):
    """
    Upserts a batch of vectorized reviews into ChromaDB.
    """
    if not ids:
        return
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )

def query_similarity(query_vector: List[float], filters: Optional[Dict[str, Any]] = None, limit: int = 10) -> Dict[str, Any]:
    """
    Searches ChromaDB for the closest semantic matches to a query vector, applying optional metadata filters.
    """
    where_clauses = []
    if filters:
        for k, v in filters.items():
            # Filter out empty or placeholder values
            if v is not None and v != "" and v != "All Personas" and v != "All Barriers":
                where_clauses.append({k: v})
                
    where = None
    if len(where_clauses) == 1:
        where = where_clauses[0]
    elif len(where_clauses) > 1:
        where = {"$and": where_clauses}
        
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=limit,
        where=where
    )
    return results

def delete_documents(ids: List[str]):
    """
    Deletes documents from collection by review_id list.
    """
    if not ids:
        return
    collection.delete(ids=ids)

def get_collection_count() -> int:
    """
    Returns total document count in collection.
    """
    return collection.count()


def reset_collection():
    """
    Phase 6 — Full rebuild: deletes the existing ChromaDB collection and
    recreates it empty. Use before a full re-sync to ensure a clean index.
    Updates the module-level `collection` reference in-place.
    """
    global collection
    try:
        chroma_client.delete_collection(name="blinkit_reviews")
        print("[vector_store] Collection 'blinkit_reviews' deleted.")
    except Exception as e:
        print(f"[vector_store] Could not delete collection (may not exist): {e}")
    collection = chroma_client.get_or_create_collection(name="blinkit_reviews")
    print("[vector_store] Collection 'blinkit_reviews' recreated empty.")
