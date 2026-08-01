# Blinkit Category Discovery Engine

> An AI-powered PM research tool that converts raw customer feedback into grounded, evidence-backed insights about category exploration barriers. Built with FastAPI, ChromaDB, BGE embeddings, and Groq.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
5. [Google Sheet Setup](#google-sheet-setup)
6. [Running the App](#running-the-app)
7. [API Endpoints](#api-endpoints)
8. [Sync & Rebuild](#sync--rebuild)
9. [Query Audit Logs](#query-audit-logs)
10. [Known Limitations](#known-limitations)
11. [Deployment](#deployment)

---

## Project Overview

The **Blinkit Category Discovery Engine** helps Growth / Product Managers answer questions like:

- *"Why don't Blinkit users try new product categories?"*
- *"What barriers stop exploratory shopping?"*
- *"Which user personas are most likely to expand their basket?"*

It does this by:
1. Syncing a structured Google Sheet of customer reviews into a local SQLite database
2. Embedding each review with `BAAI/bge-small-en-v1.5` (via `sentence-transformers`)
3. Storing embeddings in ChromaDB for semantic retrieval
4. Answering natural-language PM questions via a **RAG pipeline** grounded in real reviews, with **Groq** as the LLM

---

## Architecture

```
Google Sheets (source of truth)
        ↓  CSV export (urllib)
sync_worker.py  ←  incremental hash-based upsert
        ↓
SQLite (reviews + sync_meta tables)
        ↓
indexer.py  →  BAAI/bge-small-en-v1.5  →  ChromaDB
        ↓
rag_engine.py  →  Groq (llama-3.3-70b-versatile)
        ↓
FastAPI  →  React Frontend
```

**Key design principle:** Only retrieved review snippets are sent to Groq — never the full Google Sheet. This protects data privacy and reduces token cost.

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- A publicly readable Google Sheet (or shared link)
- A [Groq API key](https://console.groq.com/)

### 1. Clone and set up the virtual environment

```bash
cd "blinkit 1 -disocvery egine"
python -m venv v
v\Scripts\activate        # Windows
# source v/bin/activate   # macOS / Linux
```

### 2. Install backend dependencies

```bash
cd apps/api
pip install -r requirements.txt
```

### 3. Configure secrets

```bash
cp .env.example apps/api/.env
# Edit apps/api/.env and fill in your values (see below)
```

### 4. Start the backend

```bash
cd apps/api
uvicorn main:app --reload --port 8000
```

On first start, if the index is empty the server **automatically syncs** the Google Sheet.

### 5. Start the frontend

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port shown in terminal).

---

## Environment Variables

Create `apps/api/.env` with the following keys:

```env
# Required: Groq LLM API key
GROQ_API_KEY=gsk_...

# Required: Google Sheets spreadsheet ID
# e.g. from https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
SPREADSHEET_ID=your_sheet_id_here

# Optional: LLM model name (default: llama-3.3-70b-versatile)
LLM_MODEL_NAME=llama-3.3-70b-versatile

# Optional: ChromaDB storage path (default: ./data/chroma)
CHROMA_PERSIST_PATH=./data/chroma
```

> **Security:** Never commit `.env` to source control. The `.gitignore` already excludes it.

---

## Google Sheet Setup

The Google Sheet must be **publicly accessible** (Anyone with link → Viewer) for CSV export to work without OAuth.

### Required Columns

| Column | Description |
|--------|-------------|
| `review_id` | Unique identifier per review (optional — auto-generated if missing) |
| `review` | The raw customer review text (**required**) |
| `problem` | Short problem statement (**required**) |
| `pain_point` | Specific pain point label |
| `product_area` | Product category or area |
| `shopping_goal` | What the user was trying to achieve |
| `barrier_to_new_category` | Why the user didn't explore a new category |
| `user_persona` | Shopper segment label |
| `emotion` | Detected emotional tone |
| `frequency` | Shopping frequency |
| `priority` | Issue priority (High / Medium / Low) |
| `recommended_action` | Suggested PM action |

### Embedding Strategy

Each row = one embedding. The embedding is generated from a **structured text template** that combines all metadata fields — not just the raw review text. This ensures semantic search is enriched by context.

---

## Running the App

### Development mode (recommended)

Terminal 1 — Backend:
```bash
cd apps/api
..\..\v\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Terminal 2 — Frontend:
```bash
cd apps/web
npm run dev
```

### Check API health

```
GET http://localhost:8000/health
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check, index stats, config status |
| `POST` | `/sync` | Incremental sync from Google Sheet |
| `POST` | `/sync/rebuild` | Full wipe + re-sync + re-index |
| `POST` | `/query` | RAG answer generation (main PM endpoint) |
| `POST` | `/search` | Raw semantic similarity search |
| `GET` | `/filters` | Unique personas and barriers for filter dropdowns |
| `GET` | `/stats` | Aggregate dataset statistics |
| `GET` | `/logs` | Recent query audit log entries |

### Example `/query` request

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Why do users avoid exploring new categories on Blinkit?",
    "filters": {
      "user_persona": "Budget Shopper"
    }
  }'
```

---

## Sync & Rebuild

### Incremental Sync (normal use)

```
POST /sync
```

- Downloads the Google Sheet as CSV
- For each row, computes a SHA-256 hash of all fields
- Only rows with a **changed hash** are written to SQLite and re-indexed in ChromaDB
- Unchanged rows are skipped — making repeated syncs fast
- The vector index is only rebuilt if new/changed rows exist

### Scheduled Auto-Sync

The server runs an **automatic sync every 30 minutes** in the background using APScheduler. This means new rows appended to the Google Sheet (with the same schema) will appear in the engine without any manual action.

### Full Rebuild

```
POST /sync/rebuild
```

Use this when:
- The Google Sheet schema changes
- Data was corrected / rows deleted
- The ChromaDB index is corrupted

This drops the entire vector collection, clears hash cache, and performs a full re-sync + re-index.

### CLI Rebuild

```bash
cd apps/api
python sync_worker.py
```

---

## Query Audit Logs

Every `/query` call is logged to `apps/api/data/query_log.jsonl`. Each log entry contains:

```json
{
  "ts": "2025-01-15T10:23:45Z",
  "question": "Why do users avoid new categories?",
  "retrieved_ids": ["rev-001", "rev-042"],
  "model_name": "llama-3.3-70b-versatile",
  "evidence_quality": "strong",
  "sync_version": "2025-01-15T09:00:00Z"
}
```

View recent logs via API:
```
GET http://localhost:8000/logs?limit=20
```

> **Privacy note:** Logs store only metadata — the question and review IDs — never the full review text or Groq response.

---

## Known Limitations

### 1. Dataset is Ops-Heavy / Discovery-Light

> **This is the most important known limitation.**

The current dataset was scraped from Play Store, App Store, Reddit, and Kaggle. Most reviews discuss **operational issues** (delivery delays, app bugs, incorrect orders) rather than **category discovery behavior** (why users don't explore new product areas). This means:

- RAG answers about specific category exploration barriers may have `evidence_quality: "weak"` or `"insufficient"`
- Themes will skew toward operational complaints rather than discovery psychology
- **PM Action:** The dataset needs to be augmented with dedicated discovery-focused research (user interviews, in-app surveys, targeted feedback prompts)

### 2. Schema Must Match

New rows appended to the Google Sheet must follow the same column schema. If columns are renamed or added, run `/sync/rebuild` to re-index cleanly.

### 3. No Authentication

The API has no authentication layer. It should run on a **private network or behind a VPN** — not exposed to the public internet.

### 4. Groq Rate Limits

The Groq free tier has daily token limits. The engine sends only retrieved snippets (not the full sheet) to keep token usage low. If you hit limits, reduce query frequency or upgrade your Groq plan.

### 5. Local Embeddings are CPU-Bound

The `BAAI/bge-small-en-v1.5` model runs locally on CPU. Full re-indexing of 382+ reviews takes 1–3 minutes. This is acceptable for the current scale but would need GPU acceleration at 10K+ reviews.

---

## Deployment

### Local (current)

```bash
# Backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
npm run build  # then serve dist/ with any static host
```

### Simple Cloud Deploy (Render / Railway)

1. Push repo to GitHub
2. Create a **Web Service** pointing to `apps/api/`
3. Set environment variables in the dashboard
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. ChromaDB data will persist to the `/data/chroma` directory (use a persistent disk)

### Notes

- The SQLite database and ChromaDB index are stored in `apps/api/data/` — mount a persistent volume in production
- The `BAAI/bge-small-en-v1.5` model is downloaded on first run (~130MB) — pre-download in your Docker build step

---

*Built for the Blinkit Growth PM team · Phase 6 Hardened MVP*
