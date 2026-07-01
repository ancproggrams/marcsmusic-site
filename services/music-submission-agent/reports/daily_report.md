# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 45

Run 45 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 285 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 4 |
| Official public physical-mail routes observed | 3 |
| Public application/upload forms observed | 2 |
| Payment/payment-option routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected-contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| CJSW 90.9 FM Calgary Music Submissions | needs_manual_review |
| CFUV 101.9 FM Victoria Music Submissions | needs_manual_review |
| CJSR 88.5 FM Edmonton Submit Music | needs_manual_review |
| KBOO 90.7 FM Portland Submit Music | needs_manual_review |
| KOOP 91.7 FM Austin Music Library Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve external upload forms, email/download-link workflows, physical mail routing, incomplete static ingest instructions, release-age checks, album/EP-only rules, metadata and file-format requirements, FCC-clean or language warnings, AI/originality policy checks, genre/show targeting and station/programmer fit. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run45PlatformSeeds.ts
- data/run45-platform-database.json
- data/run45-review-queue.csv
- data/run45-analytics-dashboard.json
- reports/2026-07-01-run-45.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
