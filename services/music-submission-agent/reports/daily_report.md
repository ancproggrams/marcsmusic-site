# Music Submission Agent - Daily Report

Date: 2026-06-30

## Latest run: Run 32

Run 32 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 220 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public station/contact routes observed | 5 |
| Public submission forms safely observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WNCW 88.7 Studio B Music Programming Review Route | needs_manual_review |
| KFAI Fresh Air Community Radio Music Programming Route | needs_manual_review |
| WUSB 90.1 FM Stony Brook Freeform Radio Route | needs_manual_review |
| KTRU 96.1 Rice Freeform Genre-Show Music Route | needs_manual_review |
| KSCU 103.3 Santa Clara Underground Sound Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve station/show/director targeting, radio-clean/FCC-safe asset checks, rights and ownership review, outreach copy approval and incomplete or non-static public submission workflows. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run32PlatformSeeds.ts`
- `data/run32-platform-database.json`
- `data/run32-review-queue.csv`
- `data/run32-analytics-dashboard.json`
- `reports/2026-06-30-run-32.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
