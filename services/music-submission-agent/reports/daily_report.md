# Music Submission Agent - Daily Report

Date: 2026-06-30

## Latest run: Run 30

Run 30 added 3 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 3 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 210 |
| New opportunities in latest run | 3 |
| New manual-review queue rows | 3 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 3 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Physical-mail/media routes observed | 2 |
| Digital email/contact routes observed | 2 |
| Public/dynamic forms or submission navigation observed | 0 |
| Login/payment cases observed | 0 |
| CAPTCHA/anti-bot cases observed | 0 |
| Protected contacts or routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WTJU 91.1 FM UVA Submit Music Route | needs_manual_review |
| WUVT-FM 90.7 Blacksburg Physical Music Submission Route | needs_manual_review |
| KXCI 91.3 Tucson Music Department Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve genre/contact targeting, physical media preparation, stream-vs-broadcast-library rules, metadata checks, explicit-content review, high-volume music director review, FCC-clean/radio-safe checks and non-automated outreach.

## Safety summary

No accounts were created, no emails were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/login/payment/platform controls were circumvented, no protected contacts were decoded, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run30PlatformSeeds.ts`
- `data/run30-platform-database.json`
- `data/run30-review-queue.csv`
- `data/run30-analytics-dashboard.json`
- `reports/2026-06-30-run-30.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
