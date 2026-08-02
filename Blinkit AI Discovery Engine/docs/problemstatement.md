# Problem Statement

### AI-Powered Category Discovery Engine for Blinkit

**Company**: Blinkit

**Role**: Product Manager – Growth Team

**Project Objective**:
Build an AI-powered Discovery Engine that reads curated customer feedback from a Google Sheet and uses a Retrieval-Augmented Generation (RAG) model to explain why users rarely explore new product categories—with answers grounded in real review evidence.

## 1. Business Context

Quick-commerce platforms such as Blinkit have become deeply integrated into customers' daily and weekly shopping routines.

Most users repeatedly purchase the same products from the same categories. They open Blinkit with a specific shopping intent, reorder familiar items, complete the purchase quickly, and leave the app.

This behavior creates an efficient shopping experience but also limits product discovery.

**Examples**:
- Grocery shoppers rarely purchase Pet Care products.
- Snack buyers rarely explore Personal Care.
- Household Essentials buyers rarely purchase Baby Care products.

For Blinkit, encouraging customers to purchase from at least one additional category each month is an important growth opportunity. It can increase basket diversity, customer lifetime value, and long-term retention without relying solely on acquiring new customers.

## 2. The Problem

While Blinkit can observe what customers purchase, it is much harder to understand why customers remain within the same shopping categories.

**Open questions**:
- Why do customers repeatedly purchase from the same categories?
- What prevents them from trying unfamiliar categories?
- What information or reassurance do they need before making a first purchase?
- Which customer segments naturally explore more?
- How do customers currently discover new products?

These questions cannot be answered confidently without analyzing large amounts of customer feedback.

Before proposing any product solution, these behavioral patterns must first be understood using real customer evidence from the review dataset.

## 3. Project Approach

The project focuses on building a single product: a Google Sheet–backed RAG Discovery Engine.

| Focus | Description |
| :--- | :--- |
| **Data model** | Treat a curated Google Sheet of processed Blinkit reviews as the single source of truth. |
| **RAG system** | Embed and index sheet rows, retrieve relevant reviews for each question, and generate insights only from that evidence. |
| **PM workflow** | Let a Product Manager ask natural-language questions and receive cited, evidence-backed answers. |

### Tech Stack (MVP)

| Concern | Choice |
| :--- | :--- |
| **Data source** | Google Sheet (processed Blinkit reviews) |
| **Embeddings** | Local free embedder (e.g. sentence-transformers) |
| **Vector store** | Chroma (local, free) |
| **LLM** | Groq API (GROQ_API_KEY) — chat/generation only |
| **Document store** | SQLite / local store for full review records |

OpenAI is not used. Groq handles grounded answer generation; embeddings and Chroma run locally so the retrieval layer stays free.

## 4. AI Discovery Engine

### Goal

Develop an AI-powered Discovery Engine that transforms large volumes of customer feedback into structured, searchable, evidence-backed product insights.

Instead of manually reading hundreds of reviews, a Product Manager should be able to ask natural language questions and receive answers supported by actual customer feedback.

**Example questions**:
- Why don't users explore new categories?
- What shopping habits appear repeatedly?
- Which personas are most likely to experiment?
- Which barriers occur most frequently?
- What unmet needs appear consistently across reviews?

The Discovery Engine serves as a research assistant rather than a decision maker. Its purpose is to surface themes, barriers, and persona insights supported by customer evidence from the Google Sheet.

## 5. Data Source

The Discovery Engine does not collect customer reviews itself. Review collection and preprocessing are intentionally kept outside the scope of this MVP.

Instead, the Discovery Engine uses a curated Google Sheet containing AI-processed customer reviews. This Google Sheet acts as the single source of truth for the application and the RAG model.

Whenever additional reviews are processed, they will simply be appended to the same Google Sheet. The Discovery Engine should always analyze the latest available data without requiring any changes to its implementation.

This approach keeps the MVP focused on customer insight generation rather than building a large-scale review collection pipeline.

👏 👍 😊

## 6. Current Dataset

The current Google Sheet contains an initial set of processed Blinkit reviews.

Each review includes structured information such as:
- Review
- Problem
- Pain Point
- Product Area
- Shopping Goal
- User Persona
- Emotion
- Barrier to New Category
- Frequency
- Priority
- Recommended Action

### Current Limitation

Most existing reviews focus on operational issues, including:
- Delivery delays
- Refunds
- Customer support
- Delivery charges
- Missing products
- Product quality

Only a small number of reviews currently discuss shopping habits, category exploration, trust when trying unfamiliar products, or reasons customers avoid purchasing from new categories.

As a result, the current dataset is sufficient for building and testing the Discovery Engine, but it is not yet sufficient to answer every research question related to category exploration.

The dataset will continue to grow throughout the project as additional reviews focused on shopping behavior and product discovery are processed and added to the Google Sheet.

## 7. How the Discovery Engine Works

The Discovery Engine answers product research questions using customer evidence rather than assumptions.

For every question asked by a Product Manager, the system performs semantic retrieval (local embeddings + Chroma) across the processed review dataset to identify the most relevant customer feedback.

Those retrieved reviews are provided as context to an LLM via the Groq API using a Retrieval-Augmented Generation (RAG) workflow.

The Groq-hosted model generates insights only from the retrieved evidence.

Where possible, every insight should reference the reviews that contributed to the answer, allowing findings to be traced back to their original source.

This ensures that conclusions remain grounded in customer feedback instead of being generated solely from the model's prior knowledge.

## 8. Expected Capabilities

The Discovery Engine should enable a Product Manager to:
- Search customer feedback semantically
- Discover recurring themes
- Compare insights across personas
- Identify category exploration barriers
- Analyze shopping habits
- Surface unmet customer needs
- Generate evidence-backed summaries with citations

## 9. Project Scope

### Included

- Reading processed review data from Google Sheets
- Building a data/index model over the sheet for retrieval
- Local embeddings + Chroma semantic search
- Retrieval-Augmented Generation (RAG) via Groq API
- Theme identification
- Persona analysis
- Evidence-backed insight generation

### Not Included

- OpenAI (or other paid LLM/embedding APIs) as the primary provider
- Automatic review scraping
- Continuous review collection
- Social media crawling
- Production-scale ingestion pipelines
- Blinkit's internal customer databases
- Recommendation algorithms
- User interviews or interview-planning workflows

These capabilities may be considered in future iterations but are outside the scope of this MVP.

## 10. Success Criteria

The Discovery Engine will be considered successful if it enables a Product Manager to:
- Sync and query the latest Google Sheet review data through a RAG pipeline
- Understand recurring customer behaviors quickly
- Identify barriers preventing category exploration
- Generate evidence-backed summaries with traceable citations
- Rely on sheet-grounded answers even when evidence is thin (with clear insufficient-evidence messaging)

