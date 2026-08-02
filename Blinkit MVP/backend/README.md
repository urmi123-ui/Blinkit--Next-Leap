# Blinkit Finds MVP Backend Service

Self-contained backend REST service for **Blinkit Finds** discovery feed and **PDP Trust Layer** MVP.

## Tech Stack
* **Runtime:** Node.js
* **Framework:** Express
* **Database:** SQLite (embedded, saved to `blinkit_mvp.db`)

## Getting Started

### 1. Installation
Install the package dependencies:
```bash
npm install
```

### 2. Initialize and Seed the Database
Before running the server, create and populate the database tables with pilot-category mock data:
```bash
npm run seed
```
This initializes:
* Curated Finds short-form videos with product tags and priorities.
* Moderated product reviews, ratings, and customer photos.
* Verified brand authenticity records for allowlisted pilot brands.
* Remote configuration feature flags.

### 3. Start the Server
Launch the local API server:
```bash
npm start
```
The server will run on `http://localhost:3000`.

---

## API Reference

### 0. Health Check (Server & Database Monitoring)
* **Endpoint:** `GET /health`
* **Headers:**
  * `X-Health-API-Key`: Your configured monitoring API key (e.g. `blinkit_health_secret_2026`).
* **Sample Request:**
  ```bash
  curl -H "X-Health-API-Key: blinkit_health_secret_2026" http://localhost:3000/health
  ```
* **Sample Response:**
  ```json
  {
    "status": "healthy",
    "uptime": 15.44,
    "timestamp": "2026-07-30T07:07:02.141Z",
    "database": "connected"
  }
  ```

### 1. Get Remote Feature Flags
* **Endpoint:** `GET /v1/config/flags`
* **Sample Request:**
  ```bash
  curl http://localhost:3000/v1/config/flags
  ```
* **Sample Response:**
  ```json
  {
    "finds_enabled": true,
    "enhanced_pdp_trust": true,
    "pilot_category_allowlist": true,
    "finds_min_app_version": true
  }
  ```

### 2. Get Finds Video Feed (Cursor-based Pagination)
* **Endpoint:** `GET /v1/finds/feed`
* **Query Parameters:**
  * `limit` (optional, default: 5): Number of video items to retrieve.
  * `cursor` (optional): The `id` of the last video item in the previous page.
* **Sample Request:**
  ```bash
  curl "http://localhost:3000/v1/finds/feed?limit=2"
  ```
* **Sample Response:**
  ```json
  {
    "data": [
      {
        "id": "f1",
        "video_url": "https://cdn.blinkit.com/videos/finds_liptint_p101.mp4",
        "product_id": "p101",
        "product_title": "Glossy Lip Tint - Cherry Red",
        "product_price": 499,
        "category": "beauty",
        "priority": 1
      },
      {
        "id": "f2",
        "video_url": "https://cdn.blinkit.com/videos/finds_bodywash_p102.mp4",
        "product_id": "p102",
        "product_title": "Organic Aloe Body Wash 500ml",
        "product_price": 350,
        "category": "personal_care",
        "priority": 2
      }
    ],
    "next_cursor": "f2",
    "has_more": true
  }
  ```

### 3. Get Product Trust Layer Details (PDP)
* **Endpoint:** `GET /v1/trust/products/:product_id`
* **Sample Request:**
  ```bash
  curl http://localhost:3000/v1/trust/products/p101
  ```
* **Sample Response:**
  ```json
  {
    "product_id": "p101",
    "rating_summary": {
      "average_rating": 4.67,
      "total_reviews": 3
    },
    "reviews": [
      {
        "id": "r1",
        "rating": 5,
        "text": "Absolutely love this lip tint! It stays on all day and the color is gorgeous.",
        "verified_buyer": true,
        "photos": [
          "https://cdn.blinkit.com/images/p101_user_photo1.jpg",
          "https://cdn.blinkit.com/images/p101_user_photo2.jpg"
        ],
        "created_at": "2026-07-28T10:00:00Z"
      },
      {
        "id": "r2",
        "rating": 4,
        "text": "Very hydrating, but took slightly longer to deliver. Overall great quality product!",
        "verified_buyer": true,
        "photos": [],
        "created_at": "2026-07-27T14:30:00Z"
      },
      {
        "id": "r3",
        "rating": 5,
        "text": "Highly recommend. The texture is non-sticky and the shine is perfect.",
        "verified_buyer": true,
        "photos": [
          "https://cdn.blinkit.com/images/p101_user_photo3.jpg"
        ],
        "created_at": "2026-07-25T09:15:00Z"
      }
    ],
    "customer_photos": [
      "https://cdn.blinkit.com/images/p101_user_photo1.jpg",
      "https://cdn.blinkit.com/images/p101_user_photo2.jpg",
      "https://cdn.blinkit.com/images/p101_user_photo3.jpg"
    ],
    "authenticity_badge": {
      "brand_name": "The Beauty Co.",
      "badge_type": "verified_brand"
    }
  }
  ```
