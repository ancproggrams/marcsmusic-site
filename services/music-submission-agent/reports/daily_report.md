# Music Submission Agent — Daily Report

Date: 2026-06-30

## Latest run: Run 21

Run 21 added 8 newly researched public-authorized curator-marketplace, playlist-submission, licensing/sync and internet-radio opportunities for MarcsMusic and classified all 8 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 160 |
| New opportunities in latest run | 8 |
| New manual-review queue rows | 8 |
| New auto-submit candidates | 0 |
| Public business contacts observed in latest run | 2 |
| SMTP probes | 0 |
| MX probes | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Groover Global Curator Playlist Radio and Label Pitching Route | needs_manual_review |
| MusoSoup Global Music PR Curator Campaign Route | needs_manual_review |
| DailyPlaylists Spotify Playlist Submission Marketplace Route | needs_manual_review |
| Soundplate Free Spotify and Deezer Playlist Submission Route | needs_manual_review |
| Jamendo Artists Licensing In-Store and Promotion Route | needs_manual_review |
| TAXI Independent A&R Music Licensing and Label Opportunity Route | needs_manual_review |
| Audiosocket Artist Music Licensing Submission Route | needs_manual_review |
| Radio Airplay Jango Independent Artist Upload and Airplay Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve login or account flows, payment or credit decisions, artist-upload actions, rights ownership declarations, publishing/master control, campaign targeting, playlist relevance checks, licensing terms, membership/listing fit or current platform-policy review.

## Safety summary

No accounts were created, no protected forms were submitted, no payments were attempted, no music or video assets were uploaded, no terms were accepted, no contacts were guessed, and no SMTP or MX probing was performed.

## Artifacts produced

- `src/discovery/run21PlatformSeeds.ts`
- `data/run21-platform-database.json`
- `data/run21-review-queue.csv`
- `reports/2026-06-30-run-21-dashboard.md`
- `reports/2026-06-30-run-21.md`
- `reports/daily_report.md`

## Runtime note

The Railway/local worker was not started during this repo update. The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs and regenerate SQLite-backed exports.
