"""
main.py — Blinkit Category Discovery Engine API
Phase 6 Hardened Version:
  - Startup auto-sync if index is empty
  - APScheduler background scheduled sync every 30 minutes
  - /sync/rebuild endpoint for full re-index
  - /logs endpoint to inspect recent query audit log
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
import json
import threading
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

from schemas import QueryRequest, InsightResponse, ReviewRecord, SyncRequest
import database
import sync_worker
import indexer
import vector_store
import rag_engine

# Load environment variables
load_dotenv()

# ---------------------------------------------------------------------------
# Startup + scheduled sync
# ---------------------------------------------------------------------------

def _startup_sync_if_empty():
    """
    Phase 6 — Operational Hardening:
    On every server start, check whether the SQLite database and vector index are empty.
    - If SQLite has 0 rows, trigger a sync from the Google Sheet.
    - If SQLite has rows but Chroma collection count is 0, rebuild the vector index locally.
    - Otherwise, skip startup sync.
    """
    try:
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT val FROM sync_meta WHERE key = 'row_count'")
        row = cursor.fetchone()
        conn.close()
        db_count = int(row[0]) if row else 0
    except Exception:
        db_count = 0

    try:
        vector_count = vector_store.get_collection_count()
    except Exception:
        vector_count = 0

    if db_count == 0:
        print("[startup] Database row count is 0 — triggering automatic sync from Google Sheet...")
        try:
            res = sync_worker.run_sync()
            print(f"[startup] Auto-sync complete: {res}")
        except Exception as e:
            print(f"[startup] WARNING: Auto-sync failed: {e}")
    elif vector_count == 0:
        print(f"[startup] Database has {db_count} reviews, but vector index is empty. Re-indexing existing database records...")
        try:
            res = indexer.index_delta_reviews()
            print(f"[startup] Local index rebuild complete: {res}")
        except Exception as e:
            print(f"[startup] WARNING: Local index rebuild failed: {e}")
    else:
        print(f"[startup] System ready: SQLite contains {db_count} reviews, Chroma contains {vector_count} vectors. Skipping startup sync.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: runs startup tasks before accepting requests."""
    # Initialize database schema
    database.init_db()

    # Phase 6: Startup auto-sync in a background thread to prevent blocking Uvicorn / health checks
    threading.Thread(target=_startup_sync_if_empty, daemon=True).start()

    # Phase 6: Optional scheduled background sync (every 30 min)
    scheduler = None
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            func=sync_worker.run_sync,
            trigger="interval",
            minutes=30,
            id="scheduled_sync",
            replace_existing=True,
        )
        scheduler.start()
        print("[scheduler] Background sync started — every 30 minutes.")
    except ImportError:
        print("[scheduler] apscheduler not installed — scheduled sync disabled.")
    except Exception as e:
        print(f"[scheduler] WARNING: Could not start scheduler: {e}")

    yield  # App is now live and serving requests

    # Shutdown
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        print("[scheduler] Background scheduler stopped.")


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Blinkit Category Discovery Engine API",
    description=(
        "AI-powered discovery engine analyzing customer feedback to understand "
        "category exploration barriers. Powered by Groq + ChromaDB + BGE embeddings."
    ),
    version="0.6.0",
    lifespan=lifespan,
)

# Enable CORS for frontend shell
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    """Returns API health status, Groq + Sheets configuration, and index stats."""
    row_count = 0
    last_sync_at = None

    try:
        conn = database.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT val FROM sync_meta WHERE key = 'row_count'")
        row = cursor.fetchone()
        if row:
            row_count = int(row[0])

        cursor.execute("SELECT val FROM sync_meta WHERE key = 'last_sync_at'")
        row = cursor.fetchone()
        if row:
            last_sync_at = row[0]

        conn.close()
    except Exception as e:
        print("Database status error in health check:", str(e))

    return {
        "status": "ok",
        "app": "Blinkit Category Discovery Engine API",
        "version": "0.6.0",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "spreadsheet_configured": bool(os.getenv("SPREADSHEET_ID")),
        "meta": {
            "row_count": row_count,
            "last_sync_at": last_sync_at,
            "index_ready": row_count > 0,
        },
    }


@app.post("/sync", status_code=202)
def sync_sheet(req: Optional[SyncRequest] = None):
    """
    Incremental sync: fetches the Google Sheet and upserts only rows whose
    content has changed (detected via SHA-256 hash). Unchanged rows are skipped.
    Triggers vector re-indexing only if new or changed rows were written.
    """
    try:
        sheet_id = req.spreadsheet_id if req else None
        res = sync_worker.run_sync(spreadsheet_id=sheet_id)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Synchronization failed: {str(e)}",
        )


@app.post("/sync/rebuild", status_code=202)
def rebuild_index(req: Optional[SyncRequest] = None):
    """
    Phase 6 — Full rebuild: drops the existing vector index and performs
    a complete re-sync + re-index from scratch. Use when the schema changes
    or after data corrections in the Google Sheet.
    """
    try:
        sheet_id = req.spreadsheet_id if req else None
        print("[rebuild] Full rebuild requested — clearing vector store...")
        # Drop and recreate the Chroma collection
        vector_store.reset_collection()
        # Clear indexed_at timestamps so all rows are re-indexed
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE reviews SET indexed_at = NULL")
        # Also reset content hashes to force re-sync of all rows
        cursor.execute("UPDATE reviews SET content_hash = NULL")
        conn.commit()
        conn.close()

        res = sync_worker.run_sync(spreadsheet_id=sheet_id)
        return {"ok": True, "rebuild": True, **res}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rebuild failed: {str(e)}",
        )


@app.post("/search")
def search_reviews(request: QueryRequest):
    """
    Semantic search endpoint.
    Queries Chroma vector store for the top-10 most similar reviews.
    """
    try:
        query_vector = indexer.get_query_embedding(request.question)

        filters_dict = None
        if request.filters:
            filters_dict = request.filters.model_dump(exclude_none=True)

        results = vector_store.query_similarity(query_vector, filters=filters_dict, limit=10)

        search_results = []
        if results and "ids" in results and results["ids"]:
            ids = results["ids"][0]
            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0] if "distances" in results else [0.0] * len(ids)

            for idx in range(len(ids)):
                search_results.append({
                    "review_id": ids[idx],
                    "document_chunk": documents[idx],
                    "metadata": metadatas[idx],
                    "distance": float(distances[idx]),
                })

        return {"ok": True, "query": request.question, "results": search_results}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic search failed: {str(e)}",
        )


@app.post("/query", response_model=InsightResponse)
def query_engine(request: QueryRequest):
    """
    RAG synthesis query endpoint.
    Retrieves top-10 relevant reviews, sends ONLY the retrieved snippets to Groq
    (never the full sheet dump), and returns grounded, citation-backed insights.
    Query is logged to data/query_log.jsonl for audit.
    """
    return rag_engine.query_rag(request)


@app.get("/filters")
def get_filters():
    """Returns unique user personas and category exploration barriers from database."""
    try:
        return database.get_unique_filters()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch filters: {str(e)}",
        )


@app.get("/stats")
def get_stats():
    """Returns aggregate database metrics (dominant barriers, shopper segments, product areas)."""
    try:
        return database.get_database_stats()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch database statistics: {str(e)}",
        )


@app.get("/logs")
def get_query_logs(limit: int = 50):
    """
    Phase 6 — Returns the last N query audit log entries from data/query_log.jsonl.
    Each entry includes: timestamp, question, retrieved IDs, model name,
    evidence quality, and sync version.
    """
    CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
    log_path = os.path.join(CURRENT_DIR, "data", "query_log.jsonl")

    if not os.path.exists(log_path):
        return {"ok": True, "logs": [], "message": "No queries logged yet."}

    try:
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # Return the most recent `limit` entries
        recent_lines = lines[-limit:]
        logs = [json.loads(line.strip()) for line in recent_lines if line.strip()]
        logs.reverse()  # Most recent first
        return {"ok": True, "total": len(lines), "logs": logs}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read query logs: {str(e)}",
        )

# Serve frontend static files in production if dist directory exists
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
dist_path = os.path.abspath(os.path.join(CURRENT_DIR, "../web/dist"))
if os.path.exists(dist_path):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
    print(f"[static] Mounted frontend static files from: {dist_path}")

