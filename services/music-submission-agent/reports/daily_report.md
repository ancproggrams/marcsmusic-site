# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 40

Run 40 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 260 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 3 |
| Public application/upload forms observed | 2 |
| Payment routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| Protected-contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KVRX 91.7 FM Austin Music Submissions | needs_manual_review |
| WNYU 89.1 FM Music Director Submissions | needs_manual_review |
| KZSC Santa Cruz Station Music Directors | needs_manual_review |
| WHPK 88.5 FM Chicago Music Director and Format Chief Routing | needs_manual_review |
| WNUR 89.3 FM Submit Your Sound | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve physical/digital radio-submission choices, official music-director email curation, protected contact links, format-chief routing, external Google Forms, rights ownership review, clean-edit checks, metadata review, station-policy review and station fit assessment. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run40PlatformSeeds.ts
- data/run40-platform-database.json
- data/run40-review-queue.csv
- data/run40-analytics-dashboard.json
- reports/2026-07-01-run-40.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
