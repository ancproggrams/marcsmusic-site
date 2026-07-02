# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 65

Run 65 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 385 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 1 |
| Freemium/manual routes in latest run | 3 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 0 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 4 |
| Login/member/account routes observed | 5 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Songtradr Music Licensing Marketplace | needs_manual_review |
| ReverbNation Artist Opportunities and Profile Platform | needs_manual_review |
| Broadjam Song Licensing and Placement Opportunities | needs_manual_review |
| RouteNote Free-First Distribution and Publishing | needs_manual_review |
| Amuse Self-Service Distribution and Artist Services | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-licensing, artist-opportunity, song-placement, digital-distribution and artist-services workflows, but all require manual review because they involve account/login dashboards, catalog or release uploads, metadata and store/territory choices, sync/licensing or opportunity-fit decisions, optional paid memberships or premium plans, one paid subscription route, royalty/payout setup, contract or terms decisions and rights/originality assertions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run65PlatformSeeds.ts
- data/run65-platform-database.json
- data/run65-review-queue.csv
- data/run65-analytics-dashboard.json
- reports/2026-07-02-run-65.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
