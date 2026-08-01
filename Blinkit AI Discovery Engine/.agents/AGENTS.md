# Project-Scoped Rules - Category Discovery Engine

## RAG & Chunking Strategy
- **Do NOT use standard text splitters**: Do not use `RecursiveCharacterTextSplitter`, `CharacterTextSplitter`, `SentenceSplitter`, or paragraph-based chunking.
- **1:1 Row-to-Chunk Mapping**: Each Google Sheet row represents exactly one complete customer review and must be treated as a single chunk. Create exactly one embedding per review.
- **Metadata-Enriched Row Templating**: Combine the raw review text together with its metadata fields (such as `problem`, `pain_point`, `product_area`, `user_persona`, `barrier_to_new_category`, `recommended_action`) into a structured text template before generating embeddings.

## Embedding Model Configuration
- Default Local Embedding Model: `BAAI/bge-small-en-v1.5` (via `sentence-transformers` library).
