# Music Submission Agent - Daily Report

Date: 2026-06-30

## Latest run: Run 29

Run 29 added 4 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 4 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 207 |
| New opportunities in latest run | 4 |
| New manual-review queue rows | 4 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Physical-mail/media routes observed | 2 |
| Digital email/contact routes observed | 4 |
| Public/dynamic forms or submission navigation observed | 1 |
| Login/payment cases observed | 0 |
| CAPTCHA/anti-bot cases observed | 0 |
| Protected contacts or routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WFMU Freeform Radio Music Director Review Route | needs_manual_review |
| WREK Atlanta 91.1 FM Submit Music Route | needs_manual_review |
| WICB 91.7 FM Ithaca Submit Music Route | needs_manual_review |
| WXYC 89.3 FM Chapel Hill Music Department Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve physical media preparation, music director review, FCC-clean/radio-safe checks, dynamic SPA content, route confirmation, public music-department contact selection and non-automated outreach.

## Safety summary

No accounts were created, no emails were sent, no forms were submitted, no files were uploaded, no payments were attempted, no platform controls were circumvented, no protected contacts were decoded, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run29PlatformSeeds.ts`
- `data/run29-platform-database.json`
- `data/run29-review-queue.csv`
- `data/run29-analytics-dashboard.json`
- `reports/2026-06-30-run-29.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
