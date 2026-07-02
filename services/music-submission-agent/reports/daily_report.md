# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 73

Run 73 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 425 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 0 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 5 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| BBC Music Introducing Uploader | needs_manual_review |
| Triple J Unearthed Artist Upload | needs_manual_review |
| Audiomack Creator Upload | needs_manual_review |
| Bandcamp Artist and Label Upload Storefront | needs_manual_review |
| Jamendo Artist Upload and Licensing | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public upload, artist-platform, radio-discovery and music-licensing routes, but all require manual review because they involve account/login workflows, artist/profile setup, upload forms, rights/originality assertions, metadata, eligibility checks, UGC/licensing terms, pricing/payment or commission choices, AI-generated-content policy review, local/editorial/platform-fit decisions and/or licensing catalog decisions. No route in this batch exposed a safe complete public auto-submit flow.

The WMSE enrichment supplied by Marc remains represented in the run-71 database and queue exports: `mccain@msoe.edu` is treated as the public WMSE Music Director email route and remains manual-only. No email or SMTP/MX probe was performed.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or pricing settings were activated, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run73PlatformSeeds.ts
- data/run73-platform-database.json
- data/run73-review-queue.csv
- data/run73-analytics-dashboard.json
- reports/2026-07-02-run-73.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts
- src/discovery/run71PlatformSeeds.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
