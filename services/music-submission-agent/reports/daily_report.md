# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 38

Run 38 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 250 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 3 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 2 |
| Official public music/business email routes observed | 1 |
| Public application/upload forms observed | 5 |
| Payment routes observed | 2 |
| Login/member/account routes observed | 4 |
| CAPTCHA/bot-protection routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| SXSW 2027 Music Festival Showcase Application | needs_manual_review |
| The New Colossus Festival 2027 Artist Application | needs_manual_review |
| BBC Music Introducing Uploader | needs_manual_review |
| triple j Unearthed Artist Upload | needs_manual_review |
| ccMixter Creative Commons Upload and Remix Community | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve paid application checkouts, deadline-dependent pricing, owner-approved showcase materials, registration/profile setup, geographic or eligibility restrictions, UGC terms, Creative Commons license selection, attribution, source-material clearance and rights ownership review. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run38PlatformSeeds.ts
- data/run38-platform-database.json
- data/run38-review-queue.csv
- data/run38-analytics-dashboard.json
- reports/2026-07-01-run-38.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
