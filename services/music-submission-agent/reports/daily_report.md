# Music Submission Agent — Daily Report

Date: 2026-06-30

## Latest run: Run 20

Run 20 added 8 newly researched public-authorized upload, distribution, direct-to-fan, marketplace and community routes for MarcsMusic and classified all 8 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 152 |
| New opportunities in latest run | 8 |
| New manual-review queue rows | 8 |
| New auto-submit candidates | 0 |
| Public business emails stored in latest run | 0 |
| SMTP probes | 0 |
| MX probes | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Bandcamp Artist Store Direct-to-Fan Upload Route | needs_manual_review |
| SoundCloud Creator Upload and Artist Discovery Route | needs_manual_review |
| Audiomack Creator Upload and Emerging Artist Route | needs_manual_review |
| SoundOn by TikTok Artist Distribution Route | needs_manual_review |
| TIDAL Upload Independent Artist Self-Publishing Route | needs_manual_review |
| ReverbNation Artist Opportunities and Profile Route | needs_manual_review |
| Subvert.fm Cooperative Music Marketplace Artist Route | needs_manual_review |
| Mikseri.net Independent Music Upload Community Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve account access, upload or distribution actions, rights ownership declarations, territory eligibility checks, royalty or payout configuration, profile/storefront setup, licensing terms, marketplace membership, language review or current platform-policy review.

## Safety summary

No accounts were created, no protected forms were submitted, no payments were attempted, no music or video assets were uploaded, no terms were accepted, no contacts were guessed, and no SMTP or MX probing was performed.

## Artifacts produced

- `src/discovery/run20PlatformSeeds.ts`
- `data/run20-platform-database.json`
- `data/run20-submission-queue.csv`
- `reports/2026-06-30-run-20-dashboard.md`
- `reports/2026-06-30-run-20.md`
- `reports/daily_report.md`

## Runtime note

The Railway/local worker was not started during this repo update. The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs and regenerate SQLite-backed exports.
