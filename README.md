# 🛒 Blinkit — Next Leap: AI-Powered Review Analysis Engine

> An n8n automation workflow that transforms raw Blinkit customer reviews into structured product insights using LLM intelligence — fully automated, batch-processed, and saved to Google Sheets.

![Workflow Diagram](image.png)

---

## 📌 Overview

**Blinkit — Next Leap** is an end-to-end review intelligence pipeline built with [n8n](https://n8n.io/). It automatically ingests raw Blinkit customer reviews from Google Drive, cleans and preprocesses the text, sends batches to **Groq's LLaMA 3.3-70B** model for deep product analysis, and stores the structured insights in a Google Sheet — ready for product managers and analysts to act on.

The system is designed to mimic the thinking of a **Senior Product Manager**, extracting nuanced signals from every review: pain points, user personas, emotions, priorities, and actionable recommendations.

---

## ✨ Key Features

- 🔍 **Automated file discovery** from Google Drive by filename search
- 📄 **CSV ingestion & parsing** of raw Blinkit review data
- 🧹 **Text cleaning** — strips HTML tags, emojis, and extra whitespace
- 🔄 **Batch processing** with configurable batch size (default: 20 reviews/batch)
- 🤖 **LLM-powered analysis** via Groq API (LLaMA 3.3-70B) with a PM-style structured prompt
- 📊 **Structured insight extraction** across 10 product dimensions
- 💾 **Automatic output** saved to Google Sheets
- ⏱️ **Rate-limit safe** — 20-second wait between batches to respect API limits

---

## 🚀 How to Run the Project

### Prerequisites

Before running the workflow, make sure you have:

| Requirement | Details |
|---|---|
| **n8n** | Desktop, Cloud, or Self-hosted |
| **Google account** | With Drive and Sheets access |
| **Google Drive credentials** | OAuth2 configured in n8n |
| **Google Sheets credentials** | OAuth2 configured in n8n |
| **Groq API key** | From [console.groq.com](https://console.groq.com/) |
| **CSV file** | Blinkit reviews in Google Drive |

---

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd Blinkit--Next-Leap
```

---

### Step 2: Import the Workflow

1. Open **n8n**.
2. Go to **Workflows → Import from File**.
3. Select `workflow.json` from the cloned repository.

---

### Step 3: Configure Credentials

Create and connect the following credentials inside n8n:

| Credential | Used By |
|---|---|
| `Google Drive OAuth2` | Search files and folders, Download file |
| `Google Sheets OAuth2` | Save to Google Sheet |
| `Groq API` | LLM inference via HTTP Request |

> **Note:** Credentials are not included in this repository for security reasons.

---

### Step 4: Upload the CSV to Google Drive

1. Upload your reviews CSV to Google Drive.
2. Note the filename — it must match the `queryString` in the **Search files and folders** node (default: `blinkit_reviews_batch`).
3. *(Optional)* Replace the hardcoded File ID in the **Download file** node with your own Google Drive File ID.

A sample dataset is available for testing:

```
sample-data/sample_reviews.csv
```

---

### Step 5: Execute the Workflow

Click **Execute Workflow** in n8n. The pipeline will automatically:

- ✅ Read and download the CSV from Google Drive
- ✅ Clean and preprocess all review text
- ✅ Split reviews into batches of 20
- ✅ Extract structured insights using LLaMA 3.3-70B via Groq
- ✅ Parse and validate the LLM's JSON output
- ✅ Append all results to Google Sheets (Sheet1)
- ✅ Wait 20 seconds between batches to respect API rate limits

---

### Trigger

This project uses a **Manual Trigger** — the workflow runs on demand, making it ideal for controlled analysis sessions and demonstrations.

### Scheduler Note

A Schedule Trigger has **not** been included intentionally. The workflow processes a fixed review dataset and is designed for manual execution. In a production environment, a cron-based Schedule Trigger (e.g., daily or hourly) can be added to automatically process newly uploaded reviews.

---

## 🔄 Workflow Architecture

The pipeline runs as a linear + looped n8n workflow with 11 nodes:

```
Manual Trigger
    ↓
Search files and folders  [Google Drive]
    ↓
Download file             [Google Drive]
    ↓
Extract from File         [CSV → JSON]
    ↓
Code in JavaScript        [Text Cleaning]
    ↓
Loop Over Items           [Batch: 20 reviews]
    ↓ (per batch)
Code in JavaScript2       [Prompt Builder]
    ↓
HTTP Request1             [Groq API — LLaMA 3.3-70B]
    ↓
Extract Analysis          [Parse LLM response]
    ↓
Parse Analysis            [Validate & structure JSON]
    ↓
Save to Google Sheet      [Append to Sheet1]
    ↓
Wait Between Batches      [20s delay → loop back]
```

---

## 🧩 Node-by-Node Breakdown

### 1. `When clicking 'Execute workflow'`
**Type:** Manual Trigger  
Kicks off the entire pipeline on demand.

---

### 2. `Search files and folders`
**Type:** Google Drive  
Searches Google Drive for a file named **`blinkit_reviews_batch_6`**. This makes the workflow easy to adapt to new batches — just change the search query.

---

### 3. `Download file`
**Type:** Google Drive  
Downloads the matched CSV file (`blinkit_reviews_batch.csv`) from Drive into memory for processing.

---

### 4. `Extract from File`
**Type:** Extract From File (CSV)  
Parses the downloaded binary CSV into structured JSON rows — one item per review.

---

### 5. `Code in JavaScript` — *Text Cleaner*
**Type:** Code (JS)  
Sanitizes each review's `text` field by:
- Removing HTML tags (`<...>`)
- Stripping Unicode emojis
- Collapsing multiple whitespace characters into single spaces

---

### 6. `Loop Over Items`
**Type:** Split In Batches  
Splits the full cleaned review list into **batches of 20**, iterating over each batch before moving downstream. After each batch completes, the loop waits 20 seconds and processes the next batch.

---

### 7. `Code in JavaScript2` — *Prompt Builder*
**Type:** Code (JS)  
Constructs a structured Groq API request body:
- Formats all reviews in the batch as numbered text
- Appends a PM-style analysis prompt with a JSON output schema
- Sets the model to `llama-3.3-70b-versatile` with `temperature: 0.2` for deterministic analysis
- Assigns the system persona: *"You are a Senior Product Manager..."*

---

### 8. `HTTP Request1` — *Groq LLM Call*
**Type:** HTTP Request  
POSTs the prompt payload to the **Groq API** endpoint:
```
POST https://api.groq.com/openai/v1/chat/completions
```
Authenticated via Groq credentials. Has **retry on fail** enabled for resilience.

---

### 9. `Extract Analysis`
**Type:** Code (JS)  
Extracts the raw LLM response text from `choices[0].message.content`.

---

### 10. `Parse Analysis` — *Structured Output Validator*
**Type:** Code (JS)  
Robustly parses the LLM's JSON output:
- Strips markdown code fences (` ```json `) if present
- Parses into a structured array
- Applies a **fallback schema** for any malformed entries
- Maps each analysis object back to its source review with a `review_id`

---

### 11. `Save to Google Sheet`
**Type:** Google Sheets  
Appends the structured insights to **Sheet1** of the target Google Sheet using auto-mapped column mode.

---

### 12. `Wait Between Batches`
**Type:** Wait  
Pauses for **20 seconds** between each batch loop iteration — preventing API rate-limit errors on Groq.

---

## 📐 Output Schema

Each review produces one structured record with the following fields:

| Field | Description |
|---|---|
| `review_id` | Sequential ID across all batches |
| `review` | Original cleaned review text |
| `problem` | The user's main issue |
| `pain_point` | Why the issue is frustrating |
| `product_area` | One of: Delivery, Search, Pricing, Catalog, Recommendation, App Experience, Payments, Support, Other |
| `shopping_goal` | What the user was trying to accomplish |
| `barrier_to_new_category` | What prevents the user from trying new categories |
| `user_persona` | e.g. Busy Professional, Student, Parent, Health-conscious, Budget Shopper, Pet Owner |
| `emotion` | Happy, Frustrated, Confused, Excited, Disappointed, or Neutral |
| `frequency` | `Recurring` or `Occasional` |
| `priority` | `High`, `Medium`, or `Low` |
| `recommended_action` | Product improvement recommendation |

---

## 🛠️ Tech Stack

| Tool | Role |
|---|---|
| [n8n](https://n8n.io/) | Workflow automation platform |
| [Google Drive](https://drive.google.com/) | Source data storage |
| [Google Sheets](https://sheets.google.com/) | Output / results destination |
| [Groq API](https://groq.com/) | LLM inference (LLaMA 3.3-70B) |
| JavaScript | Text cleaning, prompt building, output parsing |

---

## ⚙️ Configuration Reference

After importing the workflow, update these nodes to match your own setup:

| Node | What to Update |
|---|---|
| **Search files and folders** | Set `queryString` to your CSV filename in Google Drive |
| **Download file** | Replace the File ID with your own Google Drive File ID |
| **Save to Google Sheet** | Set `documentId` to your spreadsheet ID and `sheetName` to your target sheet |
| **Loop Over Items** | Adjust `batchSize` (default: `20`) based on your dataset size |

---

## 📁 Repository Structure

```
Blinkit--Next-Leap/
├── workflow.json              # n8n workflow definition (importable)
├── image.png                  # Workflow diagram screenshot
├── sample-data/
│   └── sample_reviews.csv     # Small sample dataset for testing
└── README.md                  # This file
```

> **Note:** The complete review dataset used during development is not included in this repository. Use the sample CSV to test the pipeline end-to-end.

---

## 🔮 Potential Extensions

- 🗓️ **Scheduled trigger** — Replace the manual trigger with a cron schedule to run nightly
- 📦 **Multi-batch support** — Parameterize the filename to loop over multiple CSV batches automatically
- 📊 **Dashboard integration** — Connect the Google Sheet to Looker Studio or Power BI for live insight dashboards
- 🔔 **Slack/email alerts** — Send a summary notification when a batch run completes
- 🧠 **Embedding + clustering** — Add a vector embedding step to cluster similar pain points

---

## 📄 License

This project is open for personal and educational use. Feel free to fork, adapt, and build on it.

---

*Built with ❤️ to turn customer noise into product signal.*