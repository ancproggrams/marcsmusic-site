# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 79

Run 79 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 455 |
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
| Public application/upload/contact forms observed | 0 |
| Payment/payment-option side routes observed | 0 |
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
| WPRB 103.3 FM Music Submissions | needs_manual_review |
| KALX 90.7FM Berkeley Airplay Submissions | needs_manual_review |
| KSPC 88.7FM Music Submissions | needs_manual_review |
| WUSC 90.5 FM Outreach Music Director Submissions | needs_manual_review |
| KZSC Santa Cruz Genre Music Director Contacts | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public college, community, freeform and noncommercial radio airplay/library routes, but all require manual review because they involve outbound email approval, protected-contact handling, physical package decisions, genre-director routing, no-singles/no-demos checks, no-download/no-file-transfer compliance, metadata, release context, clean/FCC or explicit-language labeling, AI-use/originality review, rights assertions and station/DJ/editorial fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no validation controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run79PlatformSeeds.ts
- data/run79-platform-database.json
- data/run79-review-queue.csv
- data/run79-analytics-dashboard.json
- reports/2026-07-03-run-79.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
