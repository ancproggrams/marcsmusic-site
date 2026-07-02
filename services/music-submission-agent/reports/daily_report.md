# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 66

Run 66 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 390 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 2 |
| Freemium/manual routes in latest run | 3 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 2 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 3 |
| Login/member/account routes observed | 3 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| EARMILK Submit Music | needs_manual_review |
| Fresh On The Net Listening Post Submissions | needs_manual_review |
| Stereofox Music Submissions | needs_manual_review |
| Obscure Sound Music Submissions | needs_manual_review |
| The Line of Best Fit New and Unsigned Artist Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public editorial, blog, listening-post and new/unsigned-artist submission workflows, but all require manual review because they involve third-party SubmitHub, Groover, Pillargram or MusoSoup workflows, capacity-window timing, one-track limits, no-AI-generated-track eligibility checks, Google Form completion, possible paid credit/campaign choices, redacted editorial email side routes, metadata and rights/originality assertions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run66PlatformSeeds.ts
- data/run66-platform-database.json
- data/run66-review-queue.csv
- data/run66-analytics-dashboard.json
- reports/2026-07-02-run-66.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
