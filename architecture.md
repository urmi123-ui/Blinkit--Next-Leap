# Architecture

## AI-Powered Category Discovery Engine for Blinkit

This document defines the system architecture for an AI-powered Discovery Engine that turns curated Google Sheet customer feedback into evidence-backed product insights via RAG. It is derived from [`problemstatement.md`](./problemstatement.md).

---

## 1. Purpose and Design Goals

### Purpose

Enable a Product Manager to ask natural-language research questions (e.g. *Why don't users explore new categories?*) and receive answers grounded in real customer feedback from a Google Sheet, with citations back to source reviews.

### Design Goals

| Goal | Architectural implication |
|------|---------------------------|
| Evidence over assumption | RAG: retrieve first, generate only from retrieved context |
| Traceability | Every insight must cite contributing review records |
| Latest data without redeploy | Google Sheet as single source of truth; sync/index on demand or schedule |
| Sheet-backed model | Normalized review schema + embeddings + vector index derived only from the sheet |
| Research assistant, not decision maker | Surface themes and insights; do not auto-ship product recommendations |
| MVP focus | No scraping, crawling, interviews, or production ingestion pipelines |

### Non-Goals (MVP)

- Automatic review scraping / social crawling
- Continuous production-scale ingestion
- Access to Blinkit internal customer databases
- Product recommendation algorithms
- User interviews or interview-planning / research-hypothesis workflows
- Acting as an autonomous decision system

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Product Manager (Client) │
│ Ask questions · Explore themes · Compare personas · View evidence │
└────────────────────────────────┬────────────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Discovery Engine App │
│ ┌──────────────┐ ┌──────────────────┐ ┌───────────────────────────┐ │
│ │ Web UI │ │ API Gateway │ │ Insight / Chat Service │ │
│ │ (Query UX) │─▶│ (REST / RPC) │─▶│ (Orchestrates RAG) │ │
│ └──────────────┘ └──────────────────┘ └─────────────┬─────────────┘ │
│ │ │
│ ┌────────────────────────────────────┼────────────┐ │
│ │ RAG Core │ │ │
│ │ ┌─────────────┐ ┌────────────────▼──────────┐ │ │
│ │ │ Retriever │ │ Generator (Groq LLM) │ │ │
│ │ │ Semantic + │─▶│ Grounded answer + cites │ │ │
│ │ │ Chroma │ │ │ │ │
│ │ └──────▲──────┘ └───────────────────────────┘ │ │
│ └─────────┼───────────────────────────────────────┘ │
│ │ │
│ ┌───────────────────────────┼───────────────────────────────────────┐ │
│ │ Data Plane │ │
│ │ ┌─────────────┐ ┌──────┴──────┐ ┌─────────────────────────┐ │ │
│ │ │ Sheet Sync │──▶│ Local │──▶│ Chroma + Metadata Store │ │ │
│ │ │ (Google) │ │ Embeddings │ │ │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
 ▲
 │ append-only updates (offline / external)
 │
 ┌────────────┴────────────┐
 │ Google Sheet (SoT) │
 │ Processed Blinkit │
 │ customer reviews │
 └─────────────────────────┘
```

**Core idea:** Google Sheets holds curated, pre-processed reviews. The Discovery Engine syncs that data into a retrieval model (local embeddings + Chroma), retrieves relevant rows for each PM question, and asks a **Groq**-hosted LLM to synthesize insights **only** from that evidence.

---

## 3. High-Level Architecture

The system has four logical layers:

| Layer | Responsibility |
|-------|----------------|
| **Presentation** | Chat / query UI, filters (persona, product area, barrier), evidence panel with source reviews |
| **Application** | Auth (optional for MVP), query orchestration, response shaping, sync triggers |
| **Intelligence (RAG)** | Embedding, semantic retrieval, optional metadata filtering, grounded generation, citation assembly |
| **Data** | Google Sheet source of truth, local/normalized review store, vector index, sync metadata |

External systems in scope:

- **Google Sheets API** — read processed reviews
- **Embedding model** — vectorize review text + structured fields (local / free embedder; not Groq)
- **Groq API** — LLM generation for grounded answers (`GROQ_API_KEY`)

External systems explicitly out of scope:

- Review scrapers, social crawlers, Blinkit production DBs, recommendation engines, interview tools

---

## 4. Component Architecture

### 4.1 Presentation Layer

**Discovery UI**

- Natural-language query input (primary interaction)
- Optional structured filters: User Persona, Product Area, Barrier to New Category, Priority, Emotion
- Answer view with:
 - Summary insight
 - Recurring themes / barriers / habits
 - Persona comparisons (when asked)
 - **Evidence list** (linked review snippets + field metadata)
- Sync status: last sheet sync time, row count indexed

Suggested MVP screens:

1. **Ask** — Q&A with citations
2. **Explore** — browse themes / barriers / personas derived from indexed data
3. **Evidence** — open a single review record in full structured form

### 4.2 API / Application Layer

| Component | Role |
|-----------|------|
| **Query API** | Accepts question + optional filters; returns insight payload + citations |
| **Sync API** | Triggers pull from Google Sheet → normalize → re-embed deltas → update index |
| **Health / Meta API** | Dataset size, last sync, index readiness |
| **Orchestrator** | Implements the RAG pipeline: retrieve → prompt → generate → attach evidence |

### 4.3 RAG Core

#### Retriever

1. Embed the PM question
2. Run semantic similarity search over the vector index
3. Apply metadata filters (persona, barrier, product area, etc.)
4. Optionally re-rank by relevance + priority / frequency signals from the sheet
5. Return top-k review chunks with IDs and structured fields

#### Generator (Groq)

1. Build a system prompt that constrains the model to retrieved evidence only
2. Call the **Groq API** (`GROQ_API_KEY`) with a suitable chat model (e.g. Llama / Mixtral / Gemma)
3. Instruct the model to:
 - Answer the research question
 - Call out uncertainty when evidence is thin (important given current dataset bias toward ops issues)
 - Cite review IDs used
4. Parse structured output (JSON preferred) for UI rendering

Groq is used for **generation only**. Embeddings are produced by a separate local embedder.

#### Citation Binder

Map model-cited IDs back to full review records so the UI can show original text and fields (`Pain Point`, `Barrier to New Category`, etc.).

### 4.4 Data Plane

| Component | Role |
|-----------|------|
| **Sheet Connector** | Authenticate to Google Sheets; read rows; detect new/updated rows |
| **Normalizer** | Map sheet columns → internal `ReviewRecord` schema; validate required fields |
| **Chunker** | Build searchable text documents from review + structured fields |
| **Embedding Worker** | Compute local embeddings (e.g. sentence-transformers) for new/changed documents |
| **Vector Store (Chroma)** | Persist vectors + payload metadata for filtered retrieval (local, free) |
| **Document Store** (optional but recommended) | Persist full normalized records for citation lookup and Explore views |

---

## 5. Data Architecture

### 5.1 Source of Truth

**Google Sheet** is the only upstream source for MVP.

- Append-only growth: newly processed reviews are appended externally
- Discovery Engine always reads the latest sheet state on sync
- The RAG model (documents + embeddings + index) is built entirely from this sheet
- No write-back of insights into the sheet required for MVP (optional later)

### 5.2 Logical Review Schema

Aligned to the current processed dataset:

| Field | Description | Usage in system |
|-------|-------------|-----------------|
| `review_id` | Stable row identifier (sheet row id or hash) | Citations, upserts |
| `review` | Raw / processed review text | Primary semantic content |
| `problem` | Stated problem | Retrieval + theme analysis |
| `pain_point` | Specific pain | Retrieval + clustering |
| `product_area` | Category / area | Filters, persona/area cuts |
| `shopping_goal` | Intent of shopper | Habit analysis |
| `user_persona` | Segment label | Persona comparison |
| `emotion` | Affective signal | Theme / barrier nuance |
| `barrier_to_new_category` | Exploration blocker | Core research signal |
| `frequency` | How often seen | Ranking / theme weight |
| `priority` | Relative importance | Ranking / summaries |
| `recommended_action` | Suggested follow-up from sheet | Context for insights (not auto-applied) |
| `synced_at` | Ingestion timestamp | Freshness |

### 5.3 Search Document Construction

Each indexed document should concatenate high-signal fields so semantic search captures both free text and structured meaning, for example:

```text
Review: {review}
Problem: {problem}
Pain Point: {pain_point}
Product Area: {product_area}
Shopping Goal: {shopping_goal}
User Persona: {user_persona}
Emotion: {emotion}
Barrier to New Category: {barrier_to_new_category}
```

Metadata stored alongside the vector (not necessarily embedded alone): `review_id`, `product_area`, `user_persona`, `barrier_to_new_category`, `priority`, `frequency`, `emotion`.

### 5.4 Dataset Reality Constraint

The current sheet is **ops-heavy** (delivery, refunds, support, charges, missing items, quality) and **discovery-light**. Architecture must support:

- Honest “insufficient evidence” answers when retrieval is weak or off-topic
- Continuous re-sync as discovery-focused reviews are appended
- No assumption that every PM question is answerable today

---

## 6. End-to-End Flows

### 6.1 Data Sync Flow (build / refresh the sheet-backed model)

```
Google Sheet
 │
 ▼
Sheet Connector (pull all / incremental by row hash)
 │
 ▼
Normalizer → ReviewRecord[]
 │
 ├─▶ Document Store (upsert full records)
 │
 ▼
Chunk Builder → searchable text + metadata
 │
 ▼
Local Embedding Model (sentence-transformers)
 │
 ▼
Chroma (upsert by review_id)
 │
 ▼
Sync metadata updated (last_sync_at, row_count)
```

**Triggers:**

- Manual “Sync now” from UI / API
- Scheduled job (e.g. every N minutes/hours)
- Startup sync if index empty

### 6.2 Query (RAG) Flow

```
PM question (+ optional filters)
 │
 ▼
Embed query
 │
 ▼
Vector search (top-k) + metadata filters
 │
 ▼
Optional re-rank (priority / frequency / barrier relevance)
 │
 ▼
Build grounded prompt with retrieved reviews
 │
 ▼
Groq API → generate structured insight
 │
 ▼
Bind citations → full ReviewRecords
 │
 ▼
Return: answer, themes, evidence[]
```

### 6.3 Failure / Thin-Evidence Behavior

If retrieved context is empty, low-scoring, or mostly operational while the question is about category exploration:

1. Return a clear **insufficient evidence** response
2. Show what *was* retrieved (transparency)
3. Suggest how to improve the dataset (more discovery-focused reviews) and/or refine the question

---

## 7. RAG Design Details

### 7.1 Retrieval Strategy

| Technique | MVP recommendation |
|-----------|--------------------|
| Dense semantic search | Required |
| Metadata filters | Required (persona, area, barrier) |
| Hybrid keyword + vector | Optional stretch |
| Cross-encoder re-rank | Optional stretch |
| Multi-query expansion | Optional stretch |

**Default top-k:** 8–15 reviews (tune for context window and noise).

### 7.2 Prompting Contract

The generator must follow a strict contract:

1. Use **only** provided reviews as factual basis
2. Quote or paraphrase with **review_id** citations
3. Stick to **observed insights from evidence**; do not invent unsupported claims
4. Call out dataset bias when answers lean operational
5. Never invent personas, barriers, or stats not supported by retrieved rows

### 7.3 Response Schema (conceptual)

```json
{
 "answer_summary": "string",
 "key_themes": [{ "theme": "string", "support_count": 0, "review_ids": [] }],
 "barriers": [{ "barrier": "string", "review_ids": [] }],
 "persona_insights": [{ "persona": "string", "insight": "string", "review_ids": [] }],
 "evidence_quality": "strong | moderate | weak | insufficient",
 "citations": [{ "review_id": "string", "snippet": "string" }]
}
```

This shape supports expected capabilities: themes, personas, barriers, shopping habits, unmet needs, and evidence-backed summaries.

---

## 8. Technology Stack (MVP)

Locked choices for this project (OpenAI is not used):

| Concern | Choice | Notes |
|---------|--------|-------|
| Frontend | Next.js or React SPA | Chat + evidence panel |
| Backend API | FastAPI (Python) preferred | Strong ecosystem for local embeddings + RAG |
| Sheet access | Google Sheets API / service account | Read-only for MVP |
| Embeddings | **Local** sentence-transformers / Hugging Face | Free; batch on sync; Groq has no embeddings API |
| LLM | **Groq API** (e.g. Llama / Mixtral / Gemma) | Generation only; env var `GROQ_API_KEY` |
| Vector store | **Chroma** (local) | Free local vector DB |
| Document store | SQLite / Postgres | Full record lookup |
| Hosting | Local + simple cloud deploy | Keep ops light |

**Env secrets required:** Google Sheet credentials, `GROQ_API_KEY`. Embeddings and Chroma need no paid API key when run locally.

**Recommended modular packages inside the repo:**

```text
apps/
 web/ # PM-facing UI
 api/ # Query + sync APIs
packages/ or src/
 sheet/ # Google Sheet connector + normalizer
 index/ # embeddings + vector store adapters
 rag/ # retrieve, prompt, generate, cite
 domain/ # ReviewRecord types, response schemas
```

---

## 9. Security, Privacy, and Trust

| Concern | Approach |
|---------|----------|
| Sheet credentials | Service account / OAuth secrets in env; never commit |
| Customer text | Treat reviews as sensitive; restrict access to Growth/PM users |
| Groq API | Store `GROQ_API_KEY` in env; send only retrieved snippets needed for the query; avoid full-sheet dumps per request |
| Auditability | Log query, retrieved IDs, model version, sync version (no need to store full prompts forever in MVP) |
| Grounding trust | UI always shows evidence; answers are sheet-grounded only |

---

## 10. Scalability and Operational Notes

MVP scale is small (hundreds–low thousands of reviews). Design for correctness and fresh sync, not distributed ingestion.

| Concern | MVP approach |
|---------|--------------|
| Sheet growth | Full re-sync acceptable until latency hurts; then hash-based incremental upserts |
| Embedding cost | Embed only new/changed rows |
| Query latency | Cache embeddings; keep top-k modest |
| Model cost | Retrieve narrowly; avoid unnecessary multi-call agent loops |
| Index rebuild | Support full rebuild command for schema changes |

---

## 11. Mapping Capabilities → Architecture

| Expected capability | How architecture delivers it |
|---------------------|------------------------------|
| Semantic search over feedback | Embeddings + vector index over review documents from the sheet |
| Recurring themes | LLM synthesis over retrieved set + optional clustering later |
| Compare personas | Metadata filter / group-by `user_persona` in retrieve + generate |
| Category exploration barriers | Prioritize `barrier_to_new_category` in chunking, filters, and prompts |
| Shopping habits | Use `shopping_goal`, `product_area`, review text in retrieval |
| Unmet needs | Prompt asks for needs supported by pain points / problems |
| Evidence-backed summaries | Citation binder + evidence panel |

---

## 12. Scope Boundaries (Architecture View)

```
┌────────────────────────────── IN SCOPE (MVP) ─────────────────────────────┐
│ Sheet read · Normalize · Embed · Retrieve · Grounded generate · UI │
└───────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── OUT OF SCOPE (MVP) ───────────────────────────┐
│ Scraping · Crawling · Prod Blinkit DBs · Recs · Interviews · Decisioning │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Success Metrics (Architectural)

The architecture is successful when the system can:

1. Sync the latest Google Sheet into a searchable index without code changes for new appended rows (same schema)
2. Answer PM questions with **cited** reviews in interactive time
3. Filter/compare by persona and surface barrier themes when evidence exists
4. Degrade gracefully with **weak / insufficient evidence** when the dataset cannot support the question
5. Keep every answer grounded in the sheet-backed RAG model

---

## 14. Recommended Build Sequence

1. **Domain model** — `ReviewRecord` + response schema
2. **Sheet sync + normalizer** — reliable SoT ingestion
3. **Embeddings + vector index** — semantic search works standalone
4. **RAG orchestrator** — grounded answers with citations
5. **PM UI** — Ask + Evidence panels
6. **Filters & persona/barrier views** — Explore capabilities
7. **Hardening** — sync status, insufficient-evidence UX, basic logging

---

## 15. Summary

The Discovery Engine is a **RAG system over a Google Sheet source of truth**. Product Managers query in natural language; the system embeds rows with a **local embedder**, stores vectors in **Chroma**, retrieves relevant reviews, and generates insights via the **Groq API** strictly from that evidence—returning **traceable citations**. Review collection and interviews stay out of scope; the product focuses on sheet-backed insight quality and honesty about evidence gaps.

