# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 112

Run 112 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 620 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 3 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account or session-boundary routes observed | 1 |
| Challenge/session-boundary routes observed | 1 |
| Validation-field routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Redacted contact routes observed | 1 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KVRX 91.7FM Music Department Digital and Physical Airplay Submission Route | needs_manual_review |
| KSCU 103.3FM Music Director Airplay Submission Email Route | needs_manual_review |
| KALX 90.7FM Berkeley Physical CD LP Music Director Airplay Route | needs_manual_review |
| KZSC Santa Cruz Music Directors Package and Contact Form Submission Route | needs_manual_review |
| KCSB Santa Barbara Artist Inquiry Live Airplay Library and Premiere Form Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized college, student and community radio workflows, but all require manual review because they involve music-director email routing, physical-only pressed CD/LP handling, digital/physical route choice, AI-generated music policy review, public contact forms, external form handling, validation fields, redacted contact boundaries, package preparation, editorial fit, metadata, rights review and FCC-clean suitability. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no challenge or session controls were handled, no redacted contact text was resolved, no contacts were guessed and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run112PlatformSeeds.ts
- data/run112-platform-database.json
- data/run112-review-queue.csv
- data/run112-analytics-dashboard.json
- reports/2026-07-04-run-112.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts direct loader update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 112 seeds are loaded directly through `seedPlatforms.ts`, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
