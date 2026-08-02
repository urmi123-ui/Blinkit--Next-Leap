Architecture — Blinkit Finds Mobile App (Cross-Category Purchase Activation MVP)

1. Purpose

This document defines the mobile application architecture for Blinkit Finds, an MVP shipped inside the Blinkit iOS and Android apps. It increases cross-category purchases by closing the trust gap when users evaluate unfamiliar non-grocery products on mobile.

It maps the product hypothesis to mobile screens, app modules, backend APIs, data flows, experiment plumbing, and rollout controls — aligned with the problem statement.

Platform scope: Blinkit mobile app (iOS + Android) only. Web is out of scope for this MVP.





2. Architectural Goals







Goal



Mobile implication





Trust at decision time



Reviews, ratings, customer photos, and authenticity badges load on the in-app PDP with low latency on cellular





Discovery → purchase



Full-screen short-form Finds feed hands off to product card → native PDP → existing in-app cart





Measurable impact



Mobile analytics SDK emits funnel events for A/B primary, secondary, and guardrail metrics





Safe rollout



Remote feature flags gate Finds + enhanced PDP by % MAC and pilot categories, without forcing an app store release for every % ramp





MVP scope



No personalization engine, AI ranking, review incentives, platform-owned returns, or web experience



Non-goals (MVP)





Personalized recommendation / ML ranking of Finds content



AI-powered content ranking



Review incentive programs



Platform-owned returns & refunds redesign



Web / m-web parity for Finds





3. High-Level System Context (Mobile)

┌─────────────────────────────────────────────────────────────────────────┐
│ Blinkit Mobile App (iOS / Android) │
│ ┌──────────────┐ ┌─────────────────┐ ┌────────────────────────────┐ │
│ │ Blinkit Finds│ │ Native Product │ │ In-app Cart / Checkout │ │
│ │ Feed Screen │─▶│ Detail + Trust │─▶│ (existing mobile flows) │ │
│ └──────┬───────┘ └────────┬────────┘ └─────────────┬──────────────┘ │
│ │ │ │ │
│ ┌──────┴───────────────────┴─────────────────────────┴──────────────┐ │
│ │ Mobile platform layer: Feature Flags · Analytics SDK · Auth · Net │ │
│ └───────────────────────────────┬───────────────────────────────────┘ │
└──────────────────────────────────┼──────────────────────────────────────┘
 │ HTTPS
 ┌────────────────────────┼────────────────────────┐
 ▼ ▼ ▼
┌─────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│ Finds Service │ │ Trust Layer API │ │ Order / Commerce APIs │
│ (feed + media) │ │ (reviews, badges)│ │ (existing) │
└────────┬────────┘ └────────┬─────────┘ └─────────────┬────────────┘
 ▼ ▼ ▼
┌─────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│ Content / CMS │ │ Reviews Store │ │ Catalog + Inventory │
│ + CDN / Video │ │ Brand Auth Store │ │ + Purchase History │
└─────────────────┘ └──────────────────┘ └──────────────────────────┘
 │
 ▼
 ┌──────────────────────────┐
 │ Experiment + Analytics │
 │ (flags, events, metrics) │
 └──────────────────────────┘

External actors





Trust-Driven Explorer (MAC): uses the Blinkit mobile app to browse Finds, evaluate PDP trust signals, and purchase.



Ops / Content: curates Finds videos and product mappings for pilot categories.



Brand / Trust Ops: maintains Verified Brand / 100% Genuine coverage.



Experiment platform: assigns control vs treatment for mobile app users and reports north-star / guardrails.





4. Mobile App Architecture



4.1 App layer modules







Module



Responsibility





Finds Feed Screen



Full-screen vertical short-form video feed; swipe gestures; autoplay; product card overlay





Product Card (in-feed)



Contextual CTA from video → push native PDP; shows price, title, category, rating + badge teaser





Enhanced PDP Screen



Native product detail with prominent trust section: ratings, genuine reviews, customer photos, Verified Brand badge





Navigation / Entry



App entry points (e.g. home tab, bottom nav, category rail) gated by finds_enabled





Feature Flag Client



Remote config / experiment SDK; resolves Finds + enhanced PDP eligibility at app start and on resume





Mobile Analytics SDK



Emits funnel events with experiment bucket, app_platform (ios/android), app_version, product IDs





Network / API Client



Authenticated HTTPS calls to Finds, Trust, Catalog, Cart APIs; retries and offline-aware errors





Video Player



Native player with HLS/DASH, preload next clips, pause on scroll-away / background



4.2 Suggested mobile package structure

app/
├── finds/
│ ├── ui/ # Feed screen, video cell, product card overlay
│ ├── domain/ # Feed models, session cursor
│ └── data/ # Finds API client, cache
├── pdp/
│ ├── ui/ # PDP + Trust section (reviews, photos, badge)
│ ├── domain/
│ └── data/ # Catalog + Trust API clients
├── experiment/ # Flag resolution, sticky variant cache
├── analytics/ # Event definitions + SDK wrapper
└── shared/ # Auth, networking, design system components

4.3 Backend services (consumed by the mobile app)







Service



Responsibility





Finds Service



Serves curated feed items (video + product mapping) for pilot categories; pagination / session continuity





Trust Layer API



Aggregates product rating summary, review list, customer photos, authenticity badge status





Catalog Service (existing)



Product metadata, category taxonomy, availability, pricing





Order / Purchase History (existing)



Completed orders for “new category” definition and north-star computation





Experiment Service



Bucket assignment (control / treatment), exposure logging for mobile users





Analytics / Event Pipeline



Ingests mobile SDK events; powers dashboards and A/B evaluation



4.4 Data stores







Store



Contents





Finds Content Store



Feed items: video_id, product_id, category, sort/priority (manual for MVP), status





Media CDN



Transcoded short-form videos, posters, customer photos (mobile-optimized bitrates)





Reviews & Ratings Store



Verified-buyer reviews, star ratings, photo attachments, moderation status





Brand Authenticity Store



Brand/product → badge eligibility (verified_brand, genuine_100)





User Purchase History

Category × user purchase timestamps (for “new category” = outside user's usual top categories based on trailing 90-day history)





Experiment Assignments



user_id → variant, exposure timestamp, cohort, platform



4.5 On-device concerns







Concern



Approach





Cellular bandwidth



Adaptive bitrate video; preload only next 1–2 clips; compress customer photos





App backgrounding



Pause video; resume feed position via cursor





Weak network



Skeleton UI on PDP trust section; retry; never invent badges offline





App version skew



Min app version gate for Finds; flags can disable for unsupported builds





Battery / thermal



Cap aggressive preloading; pause off-screen players





5. Domain Model (MVP)

User (MAC) — mobile app session
 └── PurchaseHistory[] → Category, purchased_at, order_id, status

Category
 └── type: grocery | non_grocery
 └── pilot: beauty | personal_care | baby_care | ...

Product
 ├── category_id
 ├── brand_id
 ├── RatingSummary { avg, count }
 ├── Review[] { text, rating, photos[], verified_buyer, created_at }
 ├── AuthenticityBadge { type, visible }
 └── FindsItem? { video_url, priority, active }

ExperimentAssignment
 └── variant: control | treatment
 └── platform: ios | android

New category (product definition)

A category outside a customer's usual top categories, based on their trailing 90-day order history.

Only completed, non-refunded orders count toward MAC and new-category purchase.





6. End-to-End Mobile User Flow

1. User opens Blinkit mobile app
 │
 ▼
2. Feature Flag / Experiment SDK → assign/read variant
 │
 ├─ control ──▶ existing mobile UX (no Finds entry / baseline PDP)
 │
 └─ treatment
 │
 ▼
3. User opens Blinkit Finds (in-app entry point)
 │ GET /v1/finds/feed
 ▼
4. User watches / engages full-screen product video
 │ event: finds_video_impression | finds_video_engage
 ▼
5. Contextual product card shown over / below video
 │ event: finds_product_card_view | finds_product_card_ctr
 ▼
6. User opens native PDP
 │ GET /v1/products/{id}
 │ GET /v1/trust/products/{id} ← reviews, ratings, photos, badge
 │ event: pdp_view | trust_section_view | badge_view | review_interact
 ▼
7. Add to cart → in-app checkout (existing mobile commerce path)
 │ event: add_to_cart | purchase_complete
 ▼
8. Offline / batch: north-star + guardrail metrics jobs





7. Trust Layer Design (In-App PDP)

The Trust Layer is the core architectural response to the problem statement’s root cause, rendered natively on the mobile PDP.

7.1 Capabilities





Quality evaluation signals





Aggregate star rating + review count



Genuine buyer reviews (verified purchase preferred)



Customer photos in PDP gallery / review detail (pinch-zoom friendly on mobile)



Authenticity signals





Verified Brand / 100% Genuine badge when brand/product qualifies



If badge not available, omit it (do not invent trust)



7.2 Trust Layer API (logical)

GET /v1/trust/products/{product_id}

Response (conceptual)

{
 "product_id": "p_123",
 "rating": { "average": 4.3, "count": 128 },
 "reviews": {
 "items": [
 {
 "id": "r_1",
 "rating": 5,
 "text": "...",
 "verified_buyer": true,
 "photos": ["https://cdn/.../1.jpg"],
 "created_at": "2026-06-01T10:00:00Z"
 }
 ],
 "next_cursor": "..."
 },
 "customer_photos": ["https://cdn/.../a.jpg"],
 "authenticity": {
 "badge": "verified_brand",
 "label": "Verified Brand"
 }
}

7.3 Cold-start handling (known risk)







Condition



Mobile behavior





No / few reviews



Show rating if present; honest “limited reviews” empty state; prefer review-rich SKUs in Finds curation





No badge coverage



Hide badge; do not show fake authenticity





Sparse photos



Fall back to review text + rating only

Ops curation for Phase 2 pilot categories (Beauty, Personal Care, Baby Care) should prioritize SKUs with sufficient trust content to avoid empty trust sections on mobile PDP.





8. Finds Feed (Mobile Screen) Architecture



8.1 Feed item

{
 "item_id": "f_9",
 "video": {
 "url": "https://cdn/.../clip.m3u8",
 "duration_ms": 15000,
 "poster": "https://cdn/.../poster.jpg"
 },
 "product_id": "p_123",
 "category_id": "beauty",
 "card": {
 "title": "...",
 "price": { "amount": 299, "currency": "INR" },
 "rating_teaser": { "average": 4.3, "count": 128 },
 "badge_teaser": "verified_brand"
 }
}



8.2 Ranking (MVP)





Manual / curated ordering by content ops (out of scope: AI ranking, personalization).



Optional simple filters: pilot categories only, in-stock only, treatment users only.



Session resume via cursor / last item_id (survives app backgrounding).



8.3 Mobile media





Adaptive bitrate (HLS/DASH) via CDN with mobile-first renditions.



Preload next 1–2 clips for swipe performance.



Single active player; release decoder when cell scrolls off-screen.



Customer photos served from CDN with fixed aspect ratios for mobile PDP gallery.





9. Experiment & Feature Flag Architecture (Mobile)

Aligned with problem statement §14–§15. Flags are evaluated inside the mobile app via remote config / experiment SDK.

 ┌─────────────────────┐
 │ Experiment Service │
 │ sticky assignment │
 └──────────┬──────────┘
 │
 ┌────────────────┼────────────────┐
 ▼ ▼
 Control Treatment
 existing mobile app UX finds_enabled = true
 enhanced_pdp_trust = true
 pilot_categories = [beauty,
 personal_care, baby_care]







Flag



Control



Treatment





finds_enabled



false



true (shows Finds entry in app)





enhanced_pdp_trust



false / baseline



true (reviews, photos, badges on PDP)





pilot_category_allowlist



n/a



Beauty, Personal Care, Baby Care





finds_min_app_version



n/a



Minimum iOS/Android build that supports Finds

Rollout stages (config-driven, no store release required for % ramp)





Internal (employees / QA builds)



Pilot: 5–10% MAC on mobile



Expansion: 25–50% if metrics healthy



Full mobile rollout + later personalization (post-MVP)

Assignment must be sticky per user for clean A/B attribution across app sessions.





10. Mobile Analytics Architecture



10.1 Event taxonomy (input metrics)

| Event | Maps to |
| :--- | :--- |
| `finds_feed_open` / `finds_video_impression` / `finds_video_engage` | Blinkit Finds Engagement (CTR - Click Through Rate) |
| `finds_product_card_view` / `finds_product_card_click` | Product Card CTR |
| `pdp_view` | PDP Views |
| `pdp_time_spent` (duration in seconds) | Time Spent on Product Detail Page (PDP) |
| `review_list_view` / `review_expand` | Review Views & Interactions |
| `customer_photo_view` | Customer Photo Interactions |
| `authenticity_badge_view` / `authenticity_badge_click` | Authenticity Badge Interactions |
| `add_to_cart` | Add-to-cart rate |
| `purchase_complete` | Cross-Category Adoption Rate (CCAR) input |

Common event properties: user_id, session_id, experiment_variant, product_id, category_id, app_platform (ios android), app_version, is_new_category_for_user (server-enriched when possible), timestamp.

10.2 Metrics computation

North star

Cross-Category Adoption Rate (CCAR):
MAC who ordered ≥1 "new" category
───────────────────────────────── × 100
Total MAC

"New" = a category outside a customer's usual top categories, based on their trailing 90-day order history.

Batch / warehouse jobs

Define MAC set: users with ≥1 completed, non-refunded order in month.

For each MAC, calculate top categories based on trailing 90-day order history, and detect orders for categories outside these top categories.



Join to experiment variant via exposure / assignment tables (mobile app exposures).



Compute treatment vs control lift; publish guardrails:
- **Core-category Delivery SLA / On-time %**
- **Overall Gross Margin**
- **Refund / Return Cost as % of New Category GMV**
- **App Engagement / Session Length**

Secondary Output Metrics
- **New-category Product Detail Page (PDP) Conversion Rate**: Purchases of new-category products / PDP views of new-category products.
- **Cross-Category Adoption Rate (CCAR)**: (MAC who ordered ≥1 "new" category) ÷ (Total MAC) × 100.
- **New-category Add-to-Cart Rate**: ATC of new-category products / PDP views of new-category products.
- **Category Exploration Rate**: (Users viewing a new-category product / Total active users) × 100.
- **Products Viewed from New Categories per Session**: Average number of PDP views for products in new categories per user session.

Business Outcomes
- **"Buy more" (wallet share capture)**: Measured via incremental average spend per user.
- **New Category GMV (Sales from New Categories)**: Total GMV generated from transactions where the product's category is outside the user's usual top categories based on trailing 90-day history.
- **Category Penetration Rate (per category)**: Distinct users purchasing from category / Total Monthly Active Customers.
- **Repeat Purchase Rate**: % of users making ≥ 2 purchases in a new category within a given time window.

11. Integration with Existing Mobile Commerce Stack

Blinkit Finds and Trust Layer compose with the existing Blinkit mobile commerce flows; they do not replace checkout.

Finds / Trust (mobile UI) ──▶ Catalog (read) ──▶ Cart (write) ──▶ Orders (write)
 │
 └── Inventory / availability gates feed + ATC







Integration



Pattern





Catalog



Read product title, price, images, category into native PDP





Inventory



Exclude OOS from feed or mark unavailable on card





Cart



Reuse existing mobile add-to-cart API / deep link into cart screen





Auth



Same logged-in mobile session / token as main app





Purchase history



Read-only for new-category classification and metrics





12. Service Boundaries & Sequence (Mobile Client)



12.1 Open Finds feed

Mobile App Experiment Finds Service Catalog
 │ │ │ │
 │── getVariant() ───────▶│ │ │
 │◀─ treatment ───────────│ │ │
 │── GET /finds/feed ──────────────────────────▶│ │
 │ │ │── hydrate SKUs ─▶│
 │◀─ feed items + card teasers ─────────────────│◀─────────────────│



12.2 Open native PDP with trust

Mobile App Catalog Trust Layer API Reviews/Badge DB
 │ │ │ │
 │── GET product ────▶│ │ │
 │◀─ product DTO ─────│ │ │
 │── GET trust ────────────────────────────▶│ │
 │ │ │── read ────────────▶│
 │◀─ trust payload ─────────────────────────│◀────────────────────│

12.3 Service health check

Monitoring Probe API Gateway Database
 │ │ │
 │── GET /health (X-Health-API-Key) ──▶│ │
 │ │── test query ───────▶│
 │◀─ 200 OK (healthy) ──────────────────│◀─────────────────│

13. Security, Trust Integrity & Moderation







Concern



Approach





Fake / low-quality reviews



Verified-buyer flag; moderation queue; hide rejected content from Trust API





Badge misuse



Authenticity store owned by Trust Ops; only allowlisted brands/products emit badge





PII in reviews



Strip / redact per existing content policy





Media abuse



Photo moderation before customer photos appear on mobile PDP





Experiment integrity



Server-side sticky assignment; ignore client-declared variant for metrics





App tampering



Authenticated APIs; do not trust client-only flag overrides for metrics





14. Performance & Reliability Targets (Mobile MVP)







Surface



Target guidance





Finds feed TTFV (time to first video)



CDN + preload; do not block first frame on full trust payload





PDP trust section



Async load with skeleton; prefer p95 < 500ms for rating summary on typical 4G





Failure mode



If Trust API fails, show baseline PDP (no silent fake badges); log error + metric





Feed failure



Retry / empty state with navigate-home CTA inside the app





App kill / background



Persist feed cursor; restore without resetting experiment variant





15. Deployment Topology (Mobile)

 ┌────────────┐
 │ Edge CDN │ (video, images)
 └─────┬──────┘
 │
┌────────────┐ ┌──────┴──────┐ ┌────────────────┐
│ iOS App │───▶│ API Gateway │───▶│ Finds Service │
│ Android App│ └──────┬──────┘ │ Trust Layer API│
└────────────┘ │ │ Experiment API │
 │ └───────┬────────┘
 ▼ ▼
 ┌──────────────┐ ┌─────────────┐
 │ Existing │ │ Data stores │
 │ Commerce APIs│ │ + Warehouse │
 └──────────────┘ └─────────────┘

Release model





App Store / Play Store release ships Finds UI capability.



Percentage rollout and category allowlists are controlled by remote feature flags after the capable build is live.





16. Mapping: Problem Statement → Mobile Architecture







Problem statement element



Mobile architecture response





Trust gap on unfamiliar products



Trust Layer API + Enhanced native PDP





Limited reviews / authenticity



Reviews store + Brand Authenticity store surfaced in-app





Discovery of non-grocery



Blinkit Finds full-screen feed in the mobile app





North star: Cross-Category Adoption Rate (CCAR)



Purchase-history jobs + experiment join on mobile exposures





A/B validate trust signals



Mobile experiment SDK + event taxonomy





Pilot Beauty / Personal Care / Baby Care



Category allowlist on feed + remote flags





Out of scope: AI ranking, personalization, review incentives, returns, web



Explicitly excluded





17. Risks → Architectural Mitigations







Risk



Mitigation





Review cold-start



Curate pilot SKUs with review depth; honest empty states on mobile PDP





Limited badge coverage



Partial rollout by brand allowlist; omit when unknown





Low Finds engagement



Clear in-app entry points + content QA; measure finds_feed_open early





Fake / poor reviews



Verified buyer + moderation before Trust API exposure





Attribution difficulty



Sticky assignment, exposure events, warehouse north-star pipeline





Old app versions



finds_min_app_version gate; force-upgrade only if strictly required

👏
👍
😊



18. Phased Build Plan (Mobile Engineering)



Phase 1 — Internal





Trust API + enhanced native PDP behind flag



Finds feed screen with curated clips (iOS + Android)



Mobile analytics events + experiment assignment



QA / employee cohort on internal builds



Phase 2 — Pilot (5–10% MAC)





Allowlist Beauty, Personal Care, Baby Care



Dashboard: leading metrics + guardrails (split by ios/android if needed)



Content ops runbook for cold-start SKUs



Phase 3 — Controlled expansion (25–50%)





Scale CDN / Trust API for mobile traffic



Expand badge coverage ops process



Harden moderation SLAs



Phase 4 — Full mobile rollout





Broad enablement in the Blinkit app



Post-MVP backlog: personalization, richer discovery, ranking (explicitly deferred)





19. Exit Criteria (Mobile system readiness)

Architecture and instrumentation are “done enough” for MVP success evaluation when:





Treatment users on iOS/Android receive Finds + trust-enhanced PDP consistently.



All leading metric events fire with experiment_variant and app_platform.



North-star warehouse job matches the agreed formula and new-category definition.



Guardrail metrics (delivery SLA, gross margin, return cost as % of GMV, session length) are reportable weekly.



Trust failure modes degrade safely without inventing authenticity on the mobile PDP.





20. Open Decisions (to resolve during implementation)





Exact in-app entry point(s) for Finds (home tab, bottom nav, category rail, etc.).



Whether rating/badge teasers on the Finds product card are required for MVP or PDP-only.



Native vs cross-platform UI stack for Finds (team standard: e.g. native / RN / Flutter — follow existing Blinkit app stack).



Source of truth for “verified buyer” reviews (post-order in-app prompt vs import vs existing system).



SLA and ownership for brand authenticity allowlisting.



Real-time vs daily batch for is_new_category_for_user enrichment on events.