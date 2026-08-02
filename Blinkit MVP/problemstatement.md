Problem Statement — Cross-Category Purchase Activation MVP (Mobile App)

1. Executive Summary

Blinkit has successfully become a habitual platform for grocery and essentials purchases on its mobile app. However, Monthly Active Customers (MACs) rarely expand into unfamiliar non-grocery categories. This MVP aims to increase cross-category purchases inside the Blinkit iOS and Android apps by reducing trust-related uncertainty at the moment users evaluate unfamiliar products on mobile.

Platform scope: Blinkit mobile application (iOS + Android) only.

2. North Star Metric

Cross-Category Adoption Rate (CCAR)
% of Monthly Active Customers who buy from ≥1 new category this month

Formula:
CCAR = (MAC who ordered ≥1 "new" category) ÷ (Total MAC) × 100

Definitions:
- **Monthly Active Customer (MAC)**: Any customer who places at least one completed order (any category) in a month.
- **"New" Category**: A category outside a customer's usual top categories, based on their trailing 90-day order history.
Only completed, non-refunded orders are counted.

Why this?
- **Directly mirrors the problem statement** — no added interpretation.
- **A rate, not a raw count** — stays comparable as your MAC base grows.
- **Measures discovery** based on each customer's own purchase history.

3. Background

Quick commerce has become part of users’ weekly shopping routines. Customers frequently reorder groceries, snacks, beverages, and household essentials, resulting in highly repetitive shopping behaviour.

While Blinkit offers many additional categories, customers rarely purchase beyond their usual basket. The next growth opportunity is not acquiring more users—it is increasing category breadth within existing active customers.

4. Problem Statement

Users are not avoiding new categories because they lack interest.

They avoid them because they lack confidence when evaluating unfamiliar products.

Compared with traditional e-commerce platforms, Blinkit provides limited trust signals across many non-grocery products. Users often cannot determine whether a product is genuine, whether other buyers had a positive experience, or whether it is worth purchasing. Consequently, they leave Blinkit to validate products on Amazon, Nykaa, Google, or brand websites—or abandon the purchase altogether.

This creates a trust gap during the product evaluation stage, limiting new-category purchases among otherwise active customers.

5. Evidence
Quantitative

63.6% identified trust as the primary blocker.
43% selected genuine reviews and ratings as the most important confidence factor.
27% said recognizing a trusted or familiar brand would make them more comfortable purchasing.
Beauty category penetration (16%) is significantly lower than Grocery (92%).

Qualitative

Users reported:

“I search reviews online before buying.”
“I buy beauty products from Nykaa because I trust it.”

“I worry whether the product is counterfeit.”

These findings indicate that insufficient product validation—not lack of demand—is the primary barrier.

6. Target Users

Trust-Driven Explorers

Users who:

Are Monthly Active Customers.

Frequently buy groceries.

Occasionally browse non-grocery categories.

Show interest but hesitate before purchasing unfamiliar products.

7. Root Cause

The core problem is a trust gap.

For this MVP, the trust gap is driven by two factors:

Users cannot confidently evaluate product quality because authentic buyer reviews, ratings, and customer photos are limited.

Users cannot easily verify whether an unfamiliar brand or product is genuine.

8. Hypothesis

Trust Layer Hypothesis

If the Blinkit mobile app surfaces authentic buyer reviews, ratings, customer photos, and clear brand authenticity indicators when users evaluate unfamiliar products on the in-app PDP, then the Cross-Category Adoption Rate (CCAR) will increase because users will have sufficient trust signals to make confident purchase decisions without leaving the app.

9. MVP — Blinkit Finds (Mobile)

Blinkit Finds is a mobile in-app short-form product discovery experience (full-screen video feed on iOS/Android) that introduces users to non-grocery products and provides trust signals at the moment of highest purchase intent.

User Flow
User opens the Blinkit mobile app and enters Blinkit Finds.

User engages with a full-screen product video.
A contextual product card appears in the feed.

User opens the native Product Detail Page (PDP).

The mobile PDP prominently displays:

Genuine buyer review
Product ratings

Customer photos
Verified Brand / 100% Genuine badge

User confidently evaluates the product and completes the purchase via the existing in-app cart/checkout.

The purpose of Blinkit Finds is not simply discovery—it is to reduce purchase uncertainty by delivering a complete trust layer before checkout inside the mobile app.

Backend & Service Health: A secure Health Check API endpoint is required to monitor API gateway availability and database connectivity, ensuring continuous service health monitoring.

10. Success Metrics
North Star
Cross-Category Adoption Rate (CCAR): % of Monthly Active Customers who buy from ≥1 new category this month (where "new" is a category outside a customer's usual top categories based on trailing 90-day history).

Input Metrics
- **Blinkit Finds Engagement (CTR - Click Through Rate)** ↑
- **Product Card CTR** ↑
- **Review Views & Interactions** ↑
- **Customer Photo Interactions** ↑
- **Authenticity Badge Interactions** ↑
- **Time Spent on Product Detail Page (PDP - Product Detail page)** ↑
- **Add-to-cart rate** ↑

Output Metrics
- **New-category Product Detail Page (PDP) Conversion Rate** ↑
- **Cross-Category Adoption Rate (CCAR)** ↑
- **New-category Add-to-Cart Rate** ↑
- **Category Exploration Rate** ↑
- **Products Viewed from New Categories per Session** ↑

Guardrails
- **Core-category Delivery SLA / On-time %**
- **Overall Gross Margin**
- **Refund / Return Cost as % of New Category GMV**
- **App Engagement / Session Length**

Product Outcomes
- **Higher confidence in unfamiliar products** ↑
- **Increased exploration of new categories** ↑
- **Higher intent to purchase unfamiliar products** ↑
- **More successful new-category purchases (outside usual top categories)** ↑
- **Add-to-cart rate for new-category products** ↑
- **Purchase hesitation & Product Detail Page (PDP) abandonment** ↓

Business Outcomes
- **"Buy more" (wallet share capture)**
- **New Category GMV (Sales from New Categories)** ↑
- **Category Penetration Rate (per category)** ↑
- **Repeat Purchase Rate** ↑

11. Assumptions

Reviews and ratings increase purchase confidence.

Brand authenticity indicators increase confidence in trust-sensitive categories.

Users engage with trust signals before purchasing.

Pilot categories have sufficient review content.

Increased confidence leads to higher conversion.

12. Risks
Review cold-start problem.



Limited authenticity badge coverage across brands.



Low engagement with Blinkit Finds.



Poor-quality or fake reviews reducing trust.



Attribution challenges in measuring incremental impact.



13. Out of Scope

This MVP does not include:





Platform-owned returns & refunds



Personalized recommendation engine



AI-powered content ranking



Review incentive program



Web / m-web implementation of Blinkit Finds (mobile app only)





14. Experiment Design (A/B Test)



Objective

Validate whether Blinkit Finds increases new-category purchases by providing stronger trust signals.

Control Group





Existing Blinkit mobile app experience.



Treatment Group





Blinkit Finds enabled in the mobile app.



Native PDP enhanced with reviews, ratings, customer photos, and Verified Brand badges.



Primary Metric

Cross-Category Adoption Rate (CCAR).

Secondary (Input) Metrics

- **Blinkit Finds Engagement (CTR)**
- **Product Card CTR**
- **Review Views & Interactions**
- **Customer Photo Interactions**
- **Authenticity Badge Interactions**
- **Time Spent on PDP**
- **Add-to-cart rate**



Guardrails
- **Core-category Delivery SLA / On-time %**
- **Overall Gross Margin**
- **Refund / Return Cost as % of New Category GMV**
- **App Engagement / Session Length**





15. Rollout Strategy



Phase 1 – Internal Testing





Employees and QA on internal iOS/Android builds.



Phase 2 – Pilot





5–10% of Monthly Active Customers on the mobile app.



Beauty, Personal Care, and Baby Care.



Phase 3 – Controlled Expansion





Expand to 25–50% of mobile app users if metrics improve and guardrails remain healthy.



Phase 4 – Full Rollout





Launch broadly across the Blinkit mobile app and iterate with personalization and richer discovery.





16. Exit Criteria

The MVP is considered successful if:





Cross-Category Adoption Rate (CCAR) improves versus the control group.



Add-to-cart rate increases.



Review engagement increases.



Authenticity indicators are viewed and contribute to higher conversion.



Core-category Delivery SLA / On-time % remains stable.
Overall Gross Margin remains stable or improves.
Refund / Return Cost as % of New Category GMV remains within acceptable thresholds.
App Engagement / Session Length is stable or improves.