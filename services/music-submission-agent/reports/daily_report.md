# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 95

Run 95 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 535 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 5 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KZSC Santa Cruz Music Directors and Music Submission Form Route | needs_manual_review |
| KALX Berkeley Physical Airplay Submission Route | needs_manual_review |
| KVRX 91.7FM Austin Music Department Submission Route | needs_manual_review |
| KXLU 88.9FM Los Angeles Music Director and Demolisten Submission Route | needs_manual_review |
| KCSB-FM Santa Barbara Artist Inquiry and Music Director Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and airplay/coverage-consideration workflows, but all require manual review because they include one protected/redacted Music Director contact set, five physical-mail or package-prep routes, five official public music/business email or department routes, two public contact/external-form routes, one validation/bot-protection form case, one physical-only route that rejects digital delivery, one route with AI-origin restrictions, FCC-clean review needs, route/genre targeting, metadata checks and human editorial/radio review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments were activated, no validation/session controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run95PlatformSeeds.ts
- data/run95-platform-database.json
- data/run95-review-queue.csv
- data/run95-analytics-dashboard.json
- reports/2026-07-03-run-95.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 95 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
