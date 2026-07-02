# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 76

Run 76 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 440 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 2 |
| Official public physical-mail routes observed | 4 |
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
| Fresh On The Net Send Us A Track | needs_manual_review |
| Radio Free Brooklyn Music Submission Form | needs_manual_review |
| CKUT 90.3 FM Submitting Music | needs_manual_review |
| CJSR FM 88 Submit Music | needs_manual_review |
| KXCI Music Department Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-blog, community-radio, campus-radio, music-department, physical-mail, digital-download, email and submission-form routes, but all require manual review because they involve submission-window timing, outbound email or physical package decisions, CAPTCHA/visual-code validation, protected email links, web-form completion, station or editorial fit, metadata, release context, clean/explicit labeling, download/stream link permissions, format and eligibility checks and rights/originality assertions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no anti-bot or validation controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run76PlatformSeeds.ts
- data/run76-platform-database.json
- data/run76-review-queue.csv
- data/run76-analytics-dashboard.json
- reports/2026-07-02-run-76.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
