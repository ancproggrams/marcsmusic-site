# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 78

Run 78 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 450 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 4 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KEXP Airplay Submission Guidelines | needs_manual_review |
| KVRX 91.7 FM Music Department Submissions | needs_manual_review |
| KJHK 90.7 FM Submit Music | needs_manual_review |
| KCSU 90.5 FM Submit Your Music for Air-Play | needs_manual_review |
| KXLU 88.9 FM General and Specialty Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public college, public, non-commercial and freeform radio airplay routes, but all require manual review because they involve outbound email approval, stream or download-link permissions, metadata, release context, clean/FCC or explicit-language labeling, rights/originality assertions, local-vs-general routing, physical package decisions, external form handling and station/DJ/editorial fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no validation controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run78PlatformSeeds.ts
- data/run78-platform-database.json
- data/run78-review-queue.csv
- data/run78-analytics-dashboard.json
- reports/2026-07-02-run-78.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
