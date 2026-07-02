# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 58

Run 58 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 350 |
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
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| 2SER 107.3FM Sydney Submit Music for Airplay | needs_manual_review |
| CJSW 90.9FM Calgary Music Submissions | needs_manual_review |
| Three D Radio Adelaide Submit Your Music | needs_manual_review |
| CFUV 101.9FM Victoria Music Submissions | needs_manual_review |
| CJSR 88.5FM Edmonton Submit Music | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve public web forms, external form routing, digital package preparation, release-window and no-singles rules, three-track minimums, 320kbps MP3 or ZIP formatting, physical mail or drop-off, local-priority or local-only exceptions, non-expiring file access requirements, genre/DJ/program fit checks and metadata and rights/originality assertions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run58PlatformSeeds.ts
- data/run58-platform-database.json
- data/run58-review-queue.csv
- data/run58-analytics-dashboard.json
- reports/2026-07-02-run-58.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
