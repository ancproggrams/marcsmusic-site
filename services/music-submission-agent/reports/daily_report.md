# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 84

Run 84 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 480 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 1 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| EARMILK Submit Music via SubmitHub and Pillargram | needs_manual_review |
| WXPN Airplay Music Director and Local Show Submission Route | needs_manual_review |
| KFAI Music Department and Music Library Submission Route | needs_manual_review |
| KGNU Music Department Staff and DJ Contact Form Route | needs_manual_review |
| WMNF Submit Your Music to Music Department Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission, airplay, music-department, contact-form and curator-publication routes, but all require manual review because they involve third-party SubmitHub/Pillargram submission workflows, possible account/session and paid-credit choices, email/EPK and download-link preparation, redacted/protected public contact links, a form with reCAPTCHA v3, an audio file-upload form, artist/location/show context, file-format and file-size constraints, metadata, clean/explicit labeling, rights/originality assertions and human station/editorial fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no CAPTCHA/reCAPTCHA was interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run84PlatformSeeds.ts
- data/run84-platform-database.json
- data/run84-review-queue.csv
- data/run84-analytics-dashboard.json
- reports/2026-07-03-run-84.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
