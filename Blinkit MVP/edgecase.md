Edge Cases — Blinkit Finds MVP (Mobile App)

Edge cases for the Blinkit Finds + Trust Layer MVP, derived from problemstatement.md, architecture.md, and implementationplan.md.

Scope: Blinkit iOS / Android app — Finds feed, trust-enhanced PDP, cart handoff.



1. Trust Layer (Reviews, Ratings, Photos)







ID



Edge case



Expected behavior





T01



Product has zero reviews



Show honest “limited / no reviews” empty state; do not invent reviews





T02



Product has rating but no review text



Show rating summary only; reviews list empty with clear copy





T03



Product has very few reviews (cold-start)



Show what exists; label limited social proof; prefer not featuring thin SKUs in Finds





T04



Reviews exist but all rejected by moderation



Trust API returns empty moderated set; same as no reviews to the user





T05



Mix of verified and unverified reviews



Prefer / label verified buyers; never show rejected content





T06



Review text is extremely long



Truncate in list with expand; full text on detail without breaking PDP layout





T07



Review contains PII (phone, email, address)



Strip/redact per content policy before Trust API exposure





T08



Review in unsupported / mixed language / emoji-only



Render safely; no crash; moderation may hide policy violations





T09



Customer photos missing



Hide photo gallery; keep rating + text reviews





T10



Customer photos fail to load (CDN error)



Broken-image placeholder; rest of trust section still usable





T11



Customer photo is corrupt / wrong aspect ratio



Fail soft; skip bad asset; don’t block PDP





T12



User opens photo lightbox then rotates device / backgrounds app



Restore or close cleanly; no leaked player/memory issues





T13



Trust API timeout / 5xx



Show baseline PDP (catalog only); never show fake badge or fake rating





T14



Trust API 404 (unknown product)



Baseline PDP or “unavailable”; no crash





T15



Rating summary and review list disagree (stale cache)



Prefer single source of truth from Trust API; refresh on PDP open





T16



User scrolls reviews while pagination cursor expires



Retry fetch; show error on list only, not full PDP





T17



Partial payload (e.g. rating OK, reviews fail)



Show available parts; fail soft on failed subsection





2. Authenticity Badge







ID



Edge case



Expected behavior





B01



Brand not on allowlist



Omit badge entirely (do not show “unverified”)





B02



Brand allowlisted but this SKU excluded



Omit badge for that product





B03



Badge revoked while user is on PDP



Next refresh hides badge; no stale “100% Genuine” after revoke





B04



Feed card shows badge teaser but PDP has no badge (race / config drift)



PDP is source of truth; no invented badge





B05



Both verified_brand and genuine_100 could apply



Show one clear label per product rules; no double conflicting badges





B06



Badge asset / icon fails to load



Text label fallback or hide; never imply authenticity without signal





B07



User taps badge for info



Show short explanation; don’t deep-link to external unverified claims





3. Blinkit Finds Feed (Video & Content)







ID



Edge case



Expected behavior





F01



Empty feed (no published clips)



Empty state + retry / go home; no infinite spinner





F02



Feed returns items but all videos fail



Error per item or skip; allow swipe to next; retry





F03



Slow network / 3G



Poster first; adaptive bitrate; don’t block UI on full preload





F04



Video URL expired / 403



Skip or error state on cell; continue feed





F05



Corrupt / unsupported video codec



Fail soft; don’t crash player





F06



User swipes very fast



Only one active player; cancel stale preloads; no decoder pile-up





F07



User backgrounds app mid-video



Pause playback; resume position via cursor on return





F08



User kills app mid-feed



Restore last cursor when reopening Finds (best effort)





F09



Feed pagination end



End-of-feed state; no duplicate loop unless product intends loop





F10



Duplicate product_id across multiple clips



Allowed if curated; avoid back-to-back duplicates if easy





F11



Clip mapped to deleted product



Drop from feed or show unavailable on card; don’t open broken PDP





F12



Clip mapped to wrong category (not pilot)



Server exclude via allowlist; client shouldn’t show





F13



Autoplay blocked (OS / low power)



Show poster + tap-to-play; still allow card → PDP





F14



Silent / muted by default (OS policy)



Respect platform mute rules; optional unmute control





F15



Video longer than expected



Still play; card remains available; don’t assume fixed duration only





F16



Audio focus stolen (call / another app)



Pause Finds video





F17



Split-screen / PiP / interrupted session (Android)



Pause; restore safely





F18



Feed API returns stale cursor



Reset cursor gracefully; fetch first page

4. Product Card & Navigation







ID



Edge case



Expected behavior





C01



Card tap while video still loading



Navigate to PDP if product_id known; else disable tap





C02



Card shows price that differs on PDP



PDP/catalog is purchase truth; refresh on PDP





C03



Card shows rating teaser but PDP has no ratings



PDP empty state; don’t block purchase path





C04



User opens PDP then back to feed



Resume same video index; don’t reset to top unless intended





C05



Deep link to Finds item that was unpublished



Fallback empty / next item / home





C06



Deep link to PDP without Finds



Normal PDP; trust section still follows enhanced_pdp_trust





C07



Double-tap card / rapid navigation



Single PDP push; debounce





5. Inventory, Catalog & Commerce







ID



Edge case



Expected behavior





I01



Product goes OOS after appearing in feed



Mark unavailable on card and/or exclude on next fetch; PDP shows OOS; no successful ATC





I02



Product OOS at ATC time



Existing commerce error; user stays informed





I03



Price change between card and checkout



Checkout uses live price; show update if platform already does





I04



Product delisted / inactive



Remove from feed; PDP unavailable state





I05



Add to cart while logged out



Existing auth wall; after login return to PDP or cart per app norms





I06



Add to cart API failure



Existing error toast/retry; trust UI unaffected





I07



Cart already has max quantity / constraint



Existing cart rules apply





I08



Serviceable location doesn’t deliver this SKU



Existing location/inventory rules; don’t promise delivery in Finds





I09



User completes purchase then returns to Finds



Feed can continue; no special break unless product says so





I10



Refunded / cancelled order (metrics context)

Not counted toward MAC / new-category adoption rate (definition only; commerce UX unchanged)





6. Categories & Pilot Scope







ID



Edge case



Expected behavior





K01



Product outside Beauty / Personal Care / Baby Care



Not in Finds feed for MVP





K02



Allowlist config empty



Feed empty or Finds entry hidden; don’t show all categories





K03



Category taxonomy rename / migrate



Feed filter uses stable category IDs, not display names alone





K04



Grocery product mistakenly tagged in feed



Server-side exclude non-pilot / grocery; treat as content bug





K05



User’s “new category” vs already purchased (history)



UX can still show product; north-star classification is backend/metrics concern





K06

User purchased category within their usual top categories based on trailing 90-day history

Still may browse/buy; not a “new category” purchase for North Star Metric (CCAR)





7. Feature Flags & Experiment







ID



Edge case



Expected behavior





E01



finds_enabled=false



No Finds entry; existing app UX





E02



finds_enabled=true but enhanced_pdp_trust=false



Finds works; PDP without enhanced trust (or baseline only)





E03



enhanced_pdp_trust=true but Finds off



PDP trust can still show if product intends; Finds entry hidden





E04



App version below finds_min_app_version



Finds disabled even if % flag on





E05



Flags fail to fetch (offline / remote config down)



Safe default: off (no Finds / no partial trust invention)





E06



Variant flips mid-session (misconfig)



Prefer sticky assignment; ignore client spoofing for metrics





E07



User on control opens shared Finds deep link



Show fallback (home / PDP baseline) without treatment feed if gated





E08



Flag turns off while user is inside Finds



Finish current screen gracefully or exit to home on next navigation

👏
👍
😊



8. Auth, Session & Account







ID



Edge case



Expected behavior





A01



Guest / logged-out user opens Finds



Follow existing app auth rules (allow browse vs force login)





A02



Session expiry mid-feed or on Trust call



Re-auth; retry; don’t corrupt feed cursor silently





A03



User switches account on device



Clear feed cursor / variant cache; reload flags for new user





A04



Multiple devices same user



Sticky variant per user id server-side; independent feed cursors





9. Network & Device







ID



Edge case



Expected behavior





N01



Offline at Finds open



Offline empty/error; retry when back online





N02



Offline on PDP after feed loaded



Cached catalog if any; trust section failed-soft; no fake badge





N03



Network switches Wi‑Fi ↔ cellular mid-video



Player recovers or rebuffers; no crash





N04



Airplane mode during ATC



Existing commerce offline handling





N05



Low disk / can’t cache video



Stream without cache; degrade preload





N06



Low memory / OS kills player



Recreate player on visible cell





N07



Overheating / low power mode



Reduce preload aggressiveness; pause off-screen





N08



Poor accessibility (VoiceOver / TalkBack)



Cards, ratings, badge labeled; video controls reachable





N09



Large font / RTL layout



Trust section and card don’t clip critical CTAs





N10



Notch / gesture nav / foldable



Full-screen feed safe areas respected





10. Content Ops & Moderation







ID



Edge case



Expected behavior





O01



Ops unpublishes clip while users watch



Next fetch drops it; current item may finish then advance





O02



Fake / abusive review submitted



Held/rejected; never appears via Trust API





O03



Brand wrongly given badge



Ops revoke; badge disappears on refresh





O04



Video–product mismatch (wrong SKU)



Content bug; unpublish; users opening card see wrong PDP until fixed — prioritize QA





O05



Duplicate publish of same clip



Dedupe by item_id; stable ids





11. Analytics & Instrumentation







ID



Edge case



Expected behavior





S01



Event send fails offline



Queue/retry per existing SDK; don’t block UX





S02



Missing experiment_variant on event



SDK must attach from sticky assignment when known





S03



User watches <1s video



Define engage vs impression threshold; don’t overcount engage





S04



PDP opened from search not Finds



Events still fire; funnel attribution may differ (source property if available)





S05



Duplicate purchase_complete retries



Idempotent handling downstream





12. End-to-End Flow Edge Cases







ID



Edge case



Expected behavior





X01



Happy path



Finds → video → card → trust PDP → ATC → checkout





X02



User abandons on video (no card tap)



No PDP; impression/engage only





X03



User opens PDP, reads reviews, does not buy



Valid; trust interaction events only





X04



User buys without interacting with reviews



Allowed; badge/rating still visible





X05



User leaves Blinkit to check Nykaa/Amazon (problem we’re solving)



Can’t block; trust layer should reduce need — no special handling





X06



Treatment user sees empty trust on a Finds SKU



Should be rare (curate review-rich SKUs); still allow purchase with honest empty state





X07



Control user never sees Finds



Confirmed via finds_enabled





13. Priority for MVP handling







Priority



IDs (representative)



Why





P0 — Must handle



T01, T13, B01, F01, F07, I01, E01, E05, X01



Trust integrity, no crashes, safe defaults, core flow





P1 — Should handle



T03, T10, F03, F06, C04, K01, A02, N01



Cold-start, performance, pilot scope, session





P2 — Nice hardening



F10, N07, O04, S03, N09



Polish, ops edge, analytics precision





14. Non-goals (not MVP edge cases to “solve” in product)





Building a full returns/refunds system for trust recovery 



AI ranking when feed is empty 



Web parity edge cases 



Perfect real-time north-star computation on device





Quick reference: never do these





Never invent reviews, ratings, or authenticity badges.



Never block the whole PDP if only Trust fails.



Never show Finds content outside pilot allowlist in MVP.



Never leave a video player running off-screen / in background.



Never default flags on when remote config is unavailable.