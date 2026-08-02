# Phase-Wise Implementation Plan

### AI-Powered Category Discovery Engine for Blinkit

This plan turns [problemstatement.md](./problemstatement.md) and [architecture.md](./architecture.md) into an executable build sequence. Each phase has a clear goal, deliverables, exit criteria, and dependencies. Phases are sequential unless noted.

## Overview

| Phase | Name | Outcome |
| :--- | :--- | :--- |
| **0** | Foundations | Repo, env, domain types, stack locked |
| **1** | Sheet → Data Model | Google Sheet sync + normalized ReviewRecords |
| **2** | Embeddings + Index | Semantic search over sheet-backed documents |
| **3** | RAG Pipeline | Grounded answers with citations via API |
| **4** | PM UI (Ask + Evidence) | Product Manager can query and inspect sources |
| **5** | Explore + Filters | Personas, barriers, themes browseable with filters |
| **6** | Hardening + MVP Launch | Sync UX, thin-evidence handling, deploy readiness |

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
│ │ │
└─ sheet model ─▶ vector index ─▶ RAG answers
```

Locked stack: Google Sheet → local embeddings → Chroma → Groq API (GROQ_API_KEY) for generation. OpenAI is not used.

Out of scope for all phases: scraping, crawling, Blinkit internal DBs, recommendations, interviews, OpenAI.

### Phase 0 — Foundations

Goal: Set up the project skeleton so later phases plug into stable boundaries.

#### Work items

**Initialize monorepo / app layout aligned with architecture**:
- apps/api — backend
- apps/web — frontend
- src/domain (or packages/domain) — shared types
- src/sheet, src/index, src/rag — core modules

**Lock MVP stack (illustrative defaults from architecture)**:
- Backend: FastAPI (Python) or Node
- Frontend: Next.js / React
- Vector store: Chroma (local, free)
- Document store: SQLite / Postgres
- LLM: Groq API (GROQ_API_KEY)
- Embeddings: local/free (e.g. sentence-transformers) — Groq is for chat/generation, not embeddings

**Define env config (no secrets in git)**:
- Google Sheets credentials / sheet ID
- GROQ_API_KEY
- Vector/document store paths or URLs
- Embedding model name/path (if local)

**Implement domain schemas**:
- ReviewRecord (all sheet fields + review_id, synced_at)
- Query request (question, optional filters)
- Insight response (answer_summary, key_themes, barriers, persona_insights, evidence_quality, citations)
- Add README with setup steps and link to docs

#### Deliverables

- Runnable empty API + web shells
- Typed domain models
- .env.example documenting required secrets
#### Exit criteria

- Local API health endpoint returns OK
- Domain types match architecture schema
- Credentials load from env only
#### Dependencies

- Access to the curated Google Sheet
- Groq API key for LLM generation
- Local embedding model (or separate embedding provider if not running local)
### Phase 1 — Sheet Sync & Data Model

Goal: Make the Google Sheet the live source of truth and produce normalized review records.

#### Work items

**Sheet Connector**:
- Authenticate (service account / OAuth)
- Read all rows from the processed reviews sheet
- Map columns → ReviewRecord

**Normalizer**:
- Validate / coerce fields (review, problem, pain_point, product_area, shopping_goal, user_persona, emotion, barrier_to_new_category, frequency, priority, recommended_action)
- Generate stable review_id (row id or content hash)
- Skip or flag malformed rows without failing the whole sync

**Document Store**:
- Upsert full ReviewRecords for citation lookup

**Sync API + metadata**:
- POST /sync — pull sheet → normalize → upsert
- Persist last_sync_at, row_count
- Support full pull first; design for later hash-based incremental upserts
- CLI or script for one-shot sync (useful before UI exists)

#### Deliverables

- Working sheet → ReviewRecord[] pipeline
- Document store populated after sync
- Sync status available via API (GET /meta or /health)
#### Exit criteria

- Syncing the real Google Sheet populates the document store
- Appending a new row to the sheet and re-syncing includes it without code changes
- Every stored record has a stable review_id
- Sync failures surface clear errors (auth, missing columns, empty sheet)
#### Dependencies

- Phase 0 complete
- Sheet schema stable (column names agreed)
### Phase 2 — Embeddings & Vector Index

Goal: Build the sheet-backed retrieval model: searchable documents + vectors + metadata filters.

#### Work items

**Chunk / document builder**:
- Concatenate high-signal fields into searchable text (per architecture template)
- Attach metadata: review_id, product_area, user_persona, barrier_to_new_category, priority, frequency, emotion

**Embedding worker (local)**:
- Embed new/changed documents only with sentence-transformers (or equivalent)
- Batch embed on sync; no paid embedding API required

**Chroma vector store**:
- Upsert vectors keyed by review_id
- Support metadata-filtered similarity search

**Standalone search API (before full RAG)**:
- POST /search — query string + optional filters → top-k reviews
- Wire sync pipeline: normalize → store docs → local embed → upsert Chroma

#### Deliverables

- Semantic search over indexed sheet reviews (local embeddings + Chroma)
- Filters for persona, product area, barrier
- Sync path updates both document store and Chroma index
#### Exit criteria

- Example queries return relevant reviews (manual spot-check)
- Metadata filters narrow results correctly
- Re-sync after sheet append updates the index
- Full index rebuild command works after schema/chunk changes
#### Dependencies

- Phase 1 complete
- Local embedding model configured (e.g. sentence-transformers)
- Chroma collection created and queryable
### Phase 3 — RAG Orchestrator

Goal: Answer PM questions with insights generated only from retrieved evidence, with citations.

#### Work items

- Retriever
- Embed question → vector search (top-k 8–15) → optional filters → optional re-rank by priority/frequency
- Prompt contract
- Use only provided reviews
- Require review_id citations
- Stick to observed insights; no invented stats/personas/barriers
- Call out operational bias / thin evidence when applicable
- Generator (Groq)
- Call Groq chat completions with GROQ_API_KEY
- Request structured JSON output matching insight response schema
- Parse and validate response shape
- Citation binder
- Map cited IDs → full ReviewRecords / snippets for the client
- Evidence quality
- Score or classify strong | moderate | weak | insufficient
- If empty/low-score retrieval: return insufficient-evidence payload + what was retrieved
- Query API
- POST /query — { question, filters? } → insight + evidence
#### Deliverables

- End-to-end RAG API via Groq (no UI required yet)
- Grounded answers with citations
- Explicit thin-evidence behavior
#### Exit criteria

- Answers cite real review_ids present in retrieval
- Model does not answer from general knowledge when evidence is missing
- Category-exploration questions on ops-heavy data return honest weak/insufficient messaging when appropriate
- Response includes themes/barriers/persona fields when evidence supports them
- Golden-question smoke tests pass for the example PM questions in the problem statement
- Suggested smoke questions
- Why don't users explore new categories?
- What shopping habits appear repeatedly?
- Which personas are most likely to experiment?
- Which barriers occur most frequently?
- What unmet needs appear consistently across reviews?
#### Dependencies

- Phase 2 complete
- Groq API configured (GROQ_API_KEY)
### Phase 4 — PM UI (Ask + Evidence)

Goal: Give Product Managers a usable surface to ask questions and inspect source reviews.

#### Work items

- Ask screen
- Natural-language question input
- Submit → call Query API
- Render answer_summary, themes, barriers, persona insights
- Show evidence_quality badge
- Evidence panel
- List citations with snippets
- Expand to full structured review fields
- Sync status strip
- Last sync time, row count
- Manual “Sync now” button → Sync API
- Loading / error / empty / insufficient-evidence states
- Basic responsive layout for desktop (primary PM use case)
#### Deliverables

- Working Ask + Evidence UI wired to live API
- Manual sync from the UI
#### Exit criteria

- PM can ask a question and see a cited answer without using curl/Postman
- Clicking a citation shows the underlying review record
- Sync now refreshes data and is reflected in meta status
- Insufficient-evidence responses are clearly communicated in the UI
#### Dependencies

- Phase 3 complete
### Phase 5 — Explore, Filters & Capability Coverage

Goal: Cover remaining expected capabilities: semantic exploration, persona comparison, barrier/habit analysis via filters and Explore views.

#### Work items

- Query filters in UI
- User Persona, Product Area, Barrier to New Category, Priority, Emotion
- Pass filters through to /query and /search
- Explore screen
- Browse dominant themes / barriers / personas derived from indexed data or recent query aggregates
- Open evidence for a selected theme/barrier
- Prompt/UI tuning for capabilities
- Persona comparison questions
- Barrier-focused questions
- Shopping habit / unmet need framing in generator instructions
- Optional stretch (only if time): light hybrid keyword + vector retrieval
#### Deliverables

- Filterable Ask flow
- Explore view for themes / barriers / personas
- Capability checklist satisfied for MVP
#### Exit criteria

- Can filter by persona and compare insights across segments
- Can surface category exploration barriers when present in data
- Can analyze shopping habits / unmet needs via targeted questions
- Semantic search + evidence-backed summaries work end-to-end in UI
- Capability checklist
- Capability
- Phase where done
- Semantic search
- 2–4
- Recurring themes
- 3–5
- Compare personas
- 5
- Category exploration barriers
- 3–5
- Shopping habits
- 3–5
- Unmet needs
- 3–5
- Evidence-backed summaries with citations
- 3–4
#### Dependencies

- Phase 4 complete
### Phase 6 — Hardening & MVP Launch

Goal: Make the system reliable enough for Growth/PM use with growing sheet data.

#### Work items

**Operational hardening**:
- Startup sync if index empty
- Optional scheduled sync
- Incremental upsert by row hash (if full re-sync is slow)
- Full rebuild command documented

**Trust & safety**:
- Secrets only via env
- Send only retrieved snippets to Groq (never full sheet dump)
- Basic query logging: question, retrieved IDs, Groq model name, sync version

**Quality**:
- Tune top-k, chunk text, and prompts against real sheet data
- Improve insufficient-evidence detection thresholds
- Guard against hallucinated citation IDs (drop or remap invalid IDs)

**Docs & deploy**:
- Update README: setup, sync, query, known dataset limitations
- Simple cloud or local deploy path
- Record known limitation: dataset is ops-heavy / discovery-light

#### Deliverables

- Hardened MVP ready for PM usage
- Deployment + runbook notes
- Documented dataset limitations
#### Exit criteria

- Sync and query latest Google Sheet data through RAG without code changes for new appended rows (same schema)
- PM can understand recurring behaviors and barriers quickly via UI
- Answers are evidence-backed with traceable citations
- Thin evidence is handled honestly
- Basic logging and secret hygiene in place
#### Dependencies

- Phases 0–5 complete
## Suggested Timeline (indicative)

Adjust to team size; assumes 1–2 engineers.

| Phase | Indicative effort |
| :--- | :--- |
| **Phase 0 — Foundations** | 1–2 days |
| **Phase 1 — Sheet sync** | 2–3 days |
| **Phase 2 — Embeddings + index** | 2–3 days |
| **Phase 3 — RAG** | 3–4 days |
| **Phase 4 — Ask + Evidence UI** | 3–4 days |
| **Phase 5 — Explore + filters** | 2–3 days |
| **Phase 6 — Hardening** | 2–3 days |
| **Total** | ~2.5–3.5 weeks |

## Phase Dependencies Diagram

```text
┌─────────────┐
│ Phase 0 │
│ Foundations │
└──────┬──────┘
│
┌──────▼──────┐
│ Phase 1 │
│ Sheet Model │
└──────┬──────┘
│
┌──────▼──────┐
│ Phase 2 │
│ Vector Index│
└──────┬──────┘
│
┌──────▼──────┐
│ Phase 3 │
│ RAG + API │
└──────┬──────┘
│
┌──────▼──────┐
│ Phase 4 │
│ Ask + Evid. │
└──────┬──────┘
│
┌──────▼──────┐
│ Phase 5 │
│ Explore │
└──────┬──────┘
│
┌──────▼──────┐
│ Phase 6 │
│ Harden/MVP │
└─────────────┘
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Sheet is ops-heavy, discovery-light** | Weak answers on category exploration | Insufficient-evidence UX; grow sheet in parallel; don’t overclaim |
| **Column schema drift** | Sync breaks | Column mapping config; validation errors on sync |
| **Hallucinated citations** | Trust loss | Validate cited IDs against retrieved set before return |
| **Groq rate limits / embedding cost** | Slow queries or budget overrun | Local free embeddings; modest top-k; respect Groq RPM limits |
| **Over-scoping into recs/interviews** | Delay | Enforce non-goals from problem statement / architecture |

## Definition of Done (Project MVP)

The MVP is done when a Product Manager can:

- Sync the curated Google Sheet into the app
- Ask natural-language questions about category exploration, habits, personas, barriers, and unmet needs
- Receive Groq-grounded answers with review citations (local embeddings + Chroma retrieval)
- Filter/explore by persona and barrier signals
- See clear messaging when evidence is insufficient
- …without OpenAI, scraping, recommendations, or interview workflows.

