# Phase-Wise Implementation Plan — Blinkit Finds MVP (Mobile App)

Based on problemstatement.md and architecture.md.

**What this is:** A build plan to implement the Blinkit Finds MVP inside the Blinkit iOS / Android apps.

**MVP Outcome:** Users discover non-grocery products via a short-form Finds feed and evaluate them on a trust-enhanced PDP (reviews, ratings, customer photos, authenticity badge), then purchase through existing in-app checkout.

**Platform:** Mobile app only.

**North Star (Product Context):**
* Cross-Category Adoption Rate (CCAR) = (MAC who ordered ≥1 "new" category) ÷ (Total MAC) × 100
* "New" = a category outside a customer's usual top categories, based on their trailing 90-day order history.

---

## Phase Overview

| Phase | Name | What you build |
| :--- | :--- | :--- |
| **Phase 1** | Foundations & contracts | Flags, APIs, data models, module skeleton |
| **Phase 2** | Trust Layer | Reviews, ratings, photos, authenticity badge on PDP |
| **Phase 3** | Blinkit Finds feed | Full-screen video discovery + product card → PDP |
| **Phase 4** | End-to-end MVP integration | Wire feed → trust PDP → cart; pilot categories; analytics hooks |

```
Phase 1 Foundations --------> Phase 2 Trust Layer --------> Phase 3 Finds Feed --------> Phase 4 MVP Integration
(APIs, flags, models)         (Enhanced native PDP)         (Video feed + card)         (Full user flow live)
```

---

## Out of Scope for this MVP Build
* Personalized recommendations / AI ranking
* Review incentive program
* Platform-owned returns & refunds redesign
* Web / m-web
* Rollout %, A/B ops playbooks, and slide-ready experiment readouts (handled separately)

---

## Phase 1 — Foundations & Contracts
**Goal:** Shared contracts and app/backend scaffolding so Trust and Finds can be built in parallel.

### Build
#### Backend
* Finds content store schema (`video`, `product_id`, `category`, `priority`, `status`)
* Reviews & ratings store read model (`verified_buyer`, `moderation_status`, `photos`)
* Brand authenticity store (`verified_brand` / `genuine_100` allowlist)
* API contracts:
  * `GET /v1/finds/feed`
  * `GET /v1/trust/products/{product_id}`
  * `GET /health` (secured with `X-Health-API-Key` to verify server uptime & DB status)
* Feature flags (default off): `finds_enabled`, `enhanced_pdp_trust`, `pilot_category_allowlist`, `finds_min_app_version`
* CDN path for mobile video + customer photos

#### Mobile
* App modules: `finds/`, `pdp/` (trust), `experiment/`, `analytics/`, `shared/`
* Feature-flag client (resolve at launch / resume)
* Authenticated API client stubs for Finds + Trust
* Analytics event names + common properties wired (emit later in Phase 4)

#### Product / Content Setup
* Pilot categories locked: Beauty, Personal Care, Baby Care
* Decide Finds entry point in the app (home / tab / rail)
* Decide whether product card shows rating/badge teaser or PDP-only

### Phase 1 Done When:
* Contracts and schemas exist
* Flags exist
* Mobile modules compile with stubs
* Pilot category allowlist defined

---

## Phase 2 — Trust Layer (Enhanced PDP)
**Goal:** Close the trust gap on the native Product Detail Page.

### Build
#### Backend — Trust Layer API
`GET /v1/trust/products/{product_id}` returns:
* Rating summary (average + count)
* Genuine buyer reviews (paginated)
* Customer photos
* Authenticity badge when allowlisted; omit when not (never invent)

*Cold-start behavior:*
* Few/no reviews → honest limited-reviews state
* No badge → hide badge
* Sparse photos → rating + text only

#### Mobile — Enhanced PDP
Trust section on native PDP:
* Product ratings
* Genuine buyer reviews
* Customer photos
* Verified Brand / 100% Genuine badge
* Async load with skeleton UI
* If Trust API fails → show baseline PDP (catalog only), no fake badge

#### Ops Data
* Seed reviews/photos for pilot-category SKUs
* Seed authenticity allowlist for pilot brands

### Phase 2 Done When:
* Treatment-flagged users see trust signals on PDP
* Empty / failure states are honest and safe
* Badge only appears for allowlisted brands/products

---

## Phase 3 — Blinkit Finds Feed
**Goal:** In-app short-form discovery that introduces non-grocery products at high intent.

### Build
#### Backend — Finds Service
* `GET /v1/finds/feed` with cursor pagination
* Manual/curated ordering (no AI ranking)
* Filter to pilot categories + in-stock (via existing Catalog / Inventory)
* Feed item payload: `video URL`, `product id`, card fields (title, price, optional rating/badge teaser)

#### Mobile — Finds Screen
* Full-screen vertical short-form video feed
* Swipe / autoplay; single active player; preload next 1–2 clips
* Contextual product card on the video
* Tap card → open native PDP (trust from Phase 2)
* Entry point gated by `finds_enabled`
* Persist feed cursor across background
* Weak network / empty feed: retry + simple empty state

#### Content
* Curate Finds videos mapped to Beauty / Personal Care / Baby Care products
* Prefer SKUs that already have trust content (reviews/ratings)

### Phase 3 Done When:
* User can open Finds, watch videos, open product card → PDP
* Feed only serves pilot-category, available products
* Video playback is stable on typical mobile networks

---

## Phase 4 — End-to-End MVP Integration
**Goal:** Complete the product flow and make the MVP usable as one system.

### Build
#### User Flow (must work end-to-end)
1. Open Blinkit mobile app
2. Enter Blinkit Finds (if flagged)
3. Engage with product video
4. See contextual product card
5. Open PDP with trust layer
6. Add to cart → existing in-app checkout

#### Integration
* Reuse existing Catalog, Inventory, Cart, Auth — do not rebuild checkout
* `finds_enabled` + `enhanced_pdp_trust` control the treatment experience together
* Pilot allowlist enforced on feed (and PDP trust for those categories as designed)

#### Analytics Hooks (instrumentation only)
Emit events needed to measure the MVP later:
* `finds_feed_open` (Blinkit Finds Engagement CTR start)
* `finds_video_impression` / `finds_video_engage` (Blinkit Finds Engagement CTR calculation)
* `finds_product_card_view` / `finds_product_card_click` (Product Card CTR)
* `pdp_view` (PDP Views)
* `pdp_time_spent` (Time Spent on PDP)
* `review_list_view` / `review_expand` (Review Views & Interactions)
* `customer_photo_view` (Customer Photo Interactions)
* `authenticity_badge_view` / `authenticity_badge_click` (Authenticity Badge Interactions)
* `add_to_cart` (Add-to-cart rate)
* `purchase_complete` (Cross-Category Adoption Rate / CCAR input)

*Common properties:* `user_id`, `session_id`, `experiment_variant`, `product_id`, `category_id`, `app_platform`, `app_version`, `timestamp`

#### Experiment Plumbing (minimal for MVP)
* Sticky variant assignment available to the app
* Flags drive control vs treatment UI

### Phase 4 Done When (MVP Complete):
* Full flow works on iOS and Android: Finds → card → trust PDP → cart
* Trust signals render correctly; badges never fabricated
* Pilot categories only in Finds
* Analytics events fire on the funnel
* MVP is ready to present / demo

---

## Build Dependency Order
```
Phase 1 Foundations
 ├── Phase 2 Trust Layer (PDP) ─┐
 └── Phase 3 Finds Feed ─┴─► Phase 4 E2E MVP Integration
```
Phases 2 and 3 can run in parallel after Phase 1. Phase 4 starts when both are functionally ready.

---

## MVP Screen / API Checklist

| Surface | Depends on | Status target |
| :--- | :--- | :--- |
| Feature flags + module skeleton + Health API | Phase 1 | Ready |
| Trust API + enhanced PDP | Phase 2 | Ready |
| Finds API + feed + product card | Phase 3 | Ready |
| Finds → PDP → cart + events | Phase 4 | MVP done |

---

## Mapping to Problem / Architecture

| Need | Implemented in |
| :--- | :--- |
| Trust gap (reviews, ratings, photos, authenticity) | Phase 2 |
| Discovery of non-grocery (Blinkit Finds) | Phase 3 |
| Confident purchase without leaving the app | Phase 4 |
| Mobile-only MVP composition with existing commerce | Phases 1–4 |
| No AI ranking / personalization / web / returns redesign | Explicitly excluded |
