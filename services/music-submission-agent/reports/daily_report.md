# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 122

Run 122 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 670 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 3 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 3 |
| Login/member/account or session-boundary routes observed | 4 |
| CAPTCHA/challenge routes observed | 1 |
| JavaScript/app-session boundary routes observed | 3 |
| Validation-field routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Redacted/obfuscated contact routes observed | 0 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| A&R Factory Free and Paid Blog Review Submission Route | needs_manual_review |
| DailyPlaylists Free Spotify Playlist Marketplace Submission Route | needs_manual_review |
| SoundCampaign Spotify Playlist and TikTok Creator Paid Campaign Route | needs_manual_review |
| MusoSoup Global Curator Coverage Campaign Submission Route | needs_manual_review |
| Spotify for Artists Editorial Playlist Pitching Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized workflows, but all require manual review because they involve CAPTCHA, sign-in/account boundaries, app/session routes, optional or required payments, campaign-budget decisions, curator/playlist targeting, one-track or unreleased-release constraints, MP3/link handling, pitch metadata and editorial/platform-fit review.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no campaigns were started, no curators or playlists were selected, no messages or emails were sent, no files were uploaded or transferred, no streaming/download/private links were delivered, no payments or subscriptions were initiated, no CAPTCHA/challenge/session controls were handled, no protected or obfuscated contacts were decoded, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run122PlatformSeeds.ts
- data/run122-platform-database.json
- data/run122-review-queue.csv
- data/run122-analytics-dashboard.json
- reports/2026-07-04-run-122.md
- reports/daily_report.md
- src/discovery/run121PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 122 seeds are loaded through the existing Run 121 aggregation, which is already loaded through the Run 120, Run 119, Run 118, Run 117 and Run 113 aggregations, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
