# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 74

Run 74 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 430 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 3 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WFMU Send Music to Music Director | needs_manual_review |
| FBi Radio Music Submissions | needs_manual_review |
| PBS 106.7FM Submit Your Music | needs_manual_review |
| Triple R 102.7FM Submit Music | needs_manual_review |
| 2SER Submit Your Music for Airplay Consideration | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public radio airplay and music-director submission routes, but all require manual review because they involve outbound email or physical package decisions, web-form completion, CAPTCHA/anti-spam handling, station or presenter fit, metadata, release context, clean/explicit labeling, download/stream link permissions, location or eligibility context and rights/originality assertions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no anti-bot or validation controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run74PlatformSeeds.ts
- data/run74-platform-database.json
- data/run74-review-queue.csv
- data/run74-analytics-dashboard.json
- reports/2026-07-02-run-74.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
