# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 80

Run 80 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 460 |
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
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WREK Atlanta How To Submit Music | needs_manual_review |
| WMBR 88.1 FM How To Get Your Music Played | needs_manual_review |
| WRCT 88.3 FM Pittsburgh Music Director Submissions | needs_manual_review |
| KUTX Submit Your Music for On-Air Rotation | needs_manual_review |
| KDVS 90.3 FM Music Department Physical Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public college, community, freeform, public-radio and noncommercial radio airplay/library routes, but all require manual review because they involve outbound email approval, physical package decisions, protected-contact handling, music director or genre-director routing, no-MP3/no-attachment/no-digital-submission compliance, WAV/download-link preparation, FCC-clean/radio-edit checks, metadata, release context, rights/originality assertions and station/DJ/editorial/library fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no validation controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run80PlatformSeeds.ts
- data/run80-platform-database.json
- data/run80-review-queue.csv
- data/run80-analytics-dashboard.json
- reports/2026-07-03-run-80.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
