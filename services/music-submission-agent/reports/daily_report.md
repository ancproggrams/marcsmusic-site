# Music Submission Agent - Daily Report

Date: 2026-06-30

## Latest run: Run 28

Run 28 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 203 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Physical-mail/media routes observed | 3 |
| Digital email/contact routes observed | 4 |
| Public/external forms observed | 1 |
| Login/payment cases observed | 0 |
| CAPTCHA/anti-bot cases observed | 0 |
| Protected contacts or routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WMSE 91.7FM Milwaukee Music Department Submission Route | needs_manual_review |
| KCSB 91.9 FM Artist Inquiry and Music Library Submission Form | needs_manual_review |
| CJSR 88.5 FM Edmonton Music Submission Route | needs_manual_review |
| CFUV 101.9 FM Victoria Music Submissions | needs_manual_review |
| Radio Western 94.9FM Music Submission Email Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve physical media preparation, FCC-clean/radio-safe checks, external Google Form validation, album/EP or minimum-track eligibility, downloadable-file preparation, content metadata, paid advertising upsell blocking, degraded-site confidence checks and non-automated music-director outreach.

## Safety summary

No accounts were created, no emails were sent, no forms were submitted, no files were uploaded, no payments were attempted, no platform controls were circumvented, no protected contacts were decoded, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run28PlatformSeeds.ts`
- `data/run28-platform-database.json`
- `data/run28-review-queue.csv`
- `data/run28-analytics-dashboard.json`
- `reports/2026-06-30-run-28.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
