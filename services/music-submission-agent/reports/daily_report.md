# Music Submission Agent - Daily Report

Date: 2026-06-30

## Latest run: Run 31

Run 31 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 215 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Digital email/contact routes observed | 5 |
| Public submission navigation observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WPRK 91.5FM Rollins Music Submissions Route | needs_manual_review |
| Fredonia Radio Systems WCVF Airplay Inquiry Route | needs_manual_review |
| WRFL 88.1 FM Lexington Contact-Gated Music Review Route | needs_manual_review |
| WRIR-LP 97.3 Richmond Music Programming Contact Route | needs_manual_review |
| WHUS 91.7 FM UConn New Music Committee Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve owner-approved email outreach, radio-clean/FCC-safe asset checks, genre/show/station targeting, director or presenter selection and incomplete or non-static submission workflows.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run31PlatformSeeds.ts`
- `data/run31-platform-database.json`
- `data/run31-review-queue.csv`
- `data/run31-analytics-dashboard.json`
- `reports/2026-06-30-run-31.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
