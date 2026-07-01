# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 50

Run 50 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 310 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 3 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option routes observed | 0 |
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
| CJSF 90.1FM Burnaby Music CD Submissions | needs_manual_review |
| CHLY 101.7FM Nanaimo Submit Your Music | needs_manual_review |
| CFRU 93.3FM Guelph Music Department Submissions | needs_manual_review |
| CKUT 90.3FM Montreal Submit Music | needs_manual_review |
| CJAM 99.1FM Windsor Digital Music Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve Music Coordinator or Music Director email routes, public form workflows, physical-media mailing, local-only form eligibility, no-AI policy review, no-singles or minimum-track rules, download-link packaging, file-quality requirements, explicit-language flags, playlist/library/programmer fit and rights/metadata review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run50PlatformSeeds.ts
- data/run50-platform-database.json
- data/run50-review-queue.csv
- data/run50-analytics-dashboard.json
- reports/2026-07-01-run-50.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
