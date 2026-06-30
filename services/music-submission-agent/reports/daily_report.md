# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 34

Run 34 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 230 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 2 |
| Public contact/submission forms observed | 3 |
| CAPTCHA/validation-protected routes observed | 1 |
| Login/social-account routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Radio Free Brooklyn Music Submission Form | needs_manual_review |
| Worldwide FM Collaboration and New Voices Pitch Route | needs_manual_review |
| NTS Radio Show Proposal Audio-Link Route | needs_manual_review |
| WMSC 90.3 FM Music Director Review Route | needs_manual_review |
| WFUV 90.7 Music Department Physical Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve CAPTCHA/validation-protected public submission forms, general collaboration/contact forms, radio-show proposal forms, protected Music Director contact links, physical Music Department submissions, clean/radio-safe asset checks, rights review, metadata validation and owner-approved outreach copy. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run34PlatformSeeds.ts
- data/run34-platform-database.json
- data/run34-review-queue.csv
- data/run34-analytics-dashboard.json
- reports/2026-07-01-run-34.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
