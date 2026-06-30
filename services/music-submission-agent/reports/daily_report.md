# Music Submission Agent - Daily Report

Date: 2026-06-30

## Latest run: Run 27

Run 27 added 7 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 7 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 198 |
| New opportunities in latest run | 7 |
| New manual-review queue rows | 7 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 7 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Physical-mail/media routes observed | 6 |
| Digital email/contact routes observed | 4 |
| Public/external forms observed | 1 |
| Login/payment cases observed | 0 |
| Protected / image-rendered contacts or routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WPRB 103.3 FM Princeton Music Submissions Route | needs_manual_review |
| KXLU 88.9 FM General and Demolisten Music Submissions | needs_manual_review |
| KSPC 88.7FM Claremont Music Submissions | needs_manual_review |
| KRCL 90.9FM Salt Lake City Music Submission Route | needs_manual_review |
| WCBN-FM Ann Arbor Music Director Physical Submission Route | needs_manual_review |
| WMBR 88.1 FM MIT How To Get Your Music Played Route | needs_manual_review |
| WZBC 90.3 FM Boston College Programming Contact Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve physical media preparation, FCC-clean/radio-safe checks, station-property implications, album/EP-only restrictions, AI/originality policy checks, local/region-restricted form eligibility, genre/show targeting and one lower-confidence public contact route that requires confirmation of the preferred music-submission process.

## Safety summary

No accounts were created, no emails were sent, no forms were submitted, no files were uploaded, no payments were attempted, no platform controls were circumvented, no protected contacts were decoded, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run27PlatformSeeds.ts`
- `data/run27-platform-database.json`
- `data/run27-review-queue.csv`
- `data/run27-analytics-dashboard.json`
- `reports/2026-06-30-run-27.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
