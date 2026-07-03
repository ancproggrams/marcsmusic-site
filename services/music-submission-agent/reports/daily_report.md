# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 102

Run 102 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 570 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 3 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/session-boundary routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WPRK 91.5FM Music Submissions Email Route | needs_manual_review |
| KSPC 88.7FM Album and EP Airplay Submission Route | needs_manual_review |
| WTJU 91.1FM Genre Music Director Submission Route | needs_manual_review |
| WMNF 88.5FM Music Department Upload Form and Email Route | needs_manual_review |
| KZSU Stanford Music Director Email, Mail and Protected Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized music submission, Music Department, airplay, public email, upload-form, digital-package or physical-mail workflows, but all require manual review because they involve human-approved pitch copy, metadata, clean/radio-edit checks, downloadable-link permissions, album/EP eligibility, file format/size limits, physical package preparation, genre/Music Director routing, protected/redacted contact boundaries, no-pay-for-play and no-AI restrictions, and one cookie/session verification boundary. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no routes were activated, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run102PlatformSeeds.ts
- data/run102-platform-database.json
- data/run102-review-queue.csv
- data/run102-analytics-dashboard.json
- reports/2026-07-03-run-102.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 102 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
