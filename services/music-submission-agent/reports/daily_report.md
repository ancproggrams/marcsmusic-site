# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 68

Run 68 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 400 |
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
| Public application/upload/contact forms observed | 0 |
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
| KEXP Music Director Rotation Consideration | needs_manual_review |
| WPRB Princeton Music Submissions | needs_manual_review |
| KALX 90.7FM Berkeley Physical Music Submissions | needs_manual_review |
| CJSF 90.1FM Music CD Submissions | needs_manual_review |
| KVRX 91.7FM Austin Music Department Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public radio, freeform radio, campus radio and community radio airplay workflows, but all require manual review because they involve targeted email preparation, physical package selection/mailing, digital-vs-physical eligibility choices, no-AI/originality assertions, metadata, rights/originality assertions and programming/station-fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run68PlatformSeeds.ts
- data/run68-platform-database.json
- data/run68-review-queue.csv
- data/run68-analytics-dashboard.json
- reports/2026-07-02-run-68.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
