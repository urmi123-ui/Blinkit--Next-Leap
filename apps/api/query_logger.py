"""
query_logger.py — Phase 6: Basic query logging for auditability.
Logs each query request with: question, retrieved IDs, model name, sync version.
Writes to a local JSONL file: data/query_log.jsonl
"""
import os
import json
import datetime

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(CURRENT_DIR, "data")
LOG_PATH = os.path.join(LOG_DIR, "query_log.jsonl")


def log_query(
    question: str,
    retrieved_ids: list,
    model_name: str,
    evidence_quality: str,
    sync_version: str = None,
    citation_accuracy: float = None,
    avg_distance: float = None,
):
    """
    Appends a single query audit record to data/query_log.jsonl.
    Each line is a standalone JSON object for easy grep/parse.
    Does NOT store the full prompt or full review texts — only metadata.
    """
    os.makedirs(LOG_DIR, exist_ok=True)

    record = {
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "question": question,
        "retrieved_ids": list(retrieved_ids),
        "model_name": model_name,
        "evidence_quality": evidence_quality,
        "sync_version": sync_version or "unknown",
        "citation_accuracy": citation_accuracy,
        "avg_distance": avg_distance,
    }

    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except Exception as e:
        # Logging must never crash the main request path
        print(f"[query_logger] WARNING: failed to write log entry: {e}")

