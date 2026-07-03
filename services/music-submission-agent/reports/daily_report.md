# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 103

Run 103 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 575 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 2 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account or session-boundary routes observed | 2 |
| CAPTCHA/session-boundary routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WMFO 91.5FM Music Director and Music Department Submission Route | needs_manual_review |
| Dandelion Radio Demo Link and DJ Contact Submission Route | needs_manual_review |
| Radio Free Brooklyn Music Submission Form and Download-Link Route | needs_manual_review |
| Obscure Sound Contact, SubmitHub and MusoSoup Submission Route | needs_manual_review |
| The Line of Best Fit New and Unsigned Artist Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized music submission, music-department, demo-link, editorial, upload-form, download-link, external-platform, public contact or physical-package workflows, but all require manual review because they involve human-approved pitch copy, metadata, track-link permissions, clean/radio-edit checks, downloadable-link availability, DJ/editorial fit, image/asset rights, Google or external-platform form boundaries, reCAPTCHA/validation controls, freemium/payment-choice review and protected/blank contact boundaries. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no routes were activated, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run103PlatformSeeds.ts
- data/run103-platform-database.json
- data/run103-review-queue.csv
- data/run103-analytics-dashboard.json
- reports/2026-07-04-run-103.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts direct loader update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 103 seeds are loaded directly through `seedPlatforms.ts`, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
