# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 69

Run 69 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 405 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 4 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option side routes observed | 0 |
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
| KUTX Submit Your Music for On-Air Rotation | needs_manual_review |
| Radio K KUOM Submitting Music | needs_manual_review |
| KCR College Radio Music Submissions | needs_manual_review |
| KCSB Artist Inquiry Form | needs_manual_review |
| KZSC Santa Cruz Station Music Director Contacts | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public radio, college radio, student radio and community radio airplay/workflow routes, but all require manual review because they involve targeted email preparation, physical-vs-digital package selection, cloud-link/file prep, clean/FCC assertions, external Google Form handling, possible form validation controls, genre-director route selection, metadata, rights/originality assertions and programming/station-fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run69PlatformSeeds.ts
- data/run69-platform-database.json
- data/run69-review-queue.csv
- data/run69-analytics-dashboard.json
- reports/2026-07-02-run-69.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
