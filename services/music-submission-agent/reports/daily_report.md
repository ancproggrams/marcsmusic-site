# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 104

Run 104 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 580 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 2 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 1 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 0 |
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 3 |
| Login/member/account or session-boundary routes observed | 2 |
| CAPTCHA/session-boundary routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| EARMILK SubmitHub and Pillargram Music Submission Route | needs_manual_review |
| Stereofox SubmitHub and Groover Music Submission Route | needs_manual_review |
| A&R Factory Free and Paid Editorial Submission Form Route | needs_manual_review |
| EDM Identity Track Submission Email Route | needs_manual_review |
| House Nest Media and Promotion Submissions Form Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized music submission, editorial, playlist, blog, electronic-music media, public contact, email, external-platform or submission-form workflows, but all require manual review because they involve external SubmitHub, Pillargram or Groover sessions, paid-option avoidance, package/free-first selection, track-link permissions, release metadata, rights checks, editorial/curator fit, pitch copy, redacted contact boundaries, form handling and pricing ambiguity. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no external platform session was activated, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected or redacted contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run104PlatformSeeds.ts
- data/run104-platform-database.json
- data/run104-review-queue.csv
- data/run104-analytics-dashboard.json
- reports/2026-07-04-run-104.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts direct loader update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 104 seeds are loaded directly through `seedPlatforms.ts`, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
