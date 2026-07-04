# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 113

Run 113 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 625 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 1 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 4 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 1 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 4 |
| Login/member/account or session-boundary routes observed | 4 |
| Challenge/session-boundary routes observed | 0 |
| Validation-field routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Redacted contact routes observed | 0 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Groover Curator Playlist Radio Label and DJ Submission Platform Route | needs_manual_review |
| Soundplate Free Spotify and Deezer Playlist Submission Route | needs_manual_review |
| Playlist Push Spotify Playlist and TikTok Creator Campaign Submission Route | needs_manual_review |
| One Submit Curator Blog Radio Label Playlist and TikTok Submission Platform Route | needs_manual_review |
| TAXI Independent A&R Record Label Publishing and Sync Licensing Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized global submission workflows, but all require manual review because they involve paid credits, account/member login boundaries, app dashboards, upload/private-link handling, campaign and budget choices, curator/playlist/label/radio targeting, music metadata, rights checks, anti-spam relevance review and pitch copy. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no campaigns were started, no curators were selected, no messages or emails were sent, no files were uploaded or transferred, no download/private links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no challenge or session controls were handled, no contacts were guessed and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run113PlatformSeeds.ts
- data/run113-platform-database.json
- data/run113-review-queue.csv
- data/run113-analytics-dashboard.json
- reports/2026-07-04-run-113.md
- reports/daily_report.md
- src/discovery/run112PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 113 seeds are loaded through the existing Run 112 aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
