# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 99

Run 99 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 555 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 2 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 2 |
| Login/member/account routes observed | 3 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Spotify for Artists Editorial Playlist Pitching Route | needs_manual_review |
| MusoSoup Artist Campaign Music Submission Route | needs_manual_review |
| DailyPlaylists Free Spotify Playlist Submission Route | needs_manual_review |
| KBOO Portland Physical Music Submission Route | needs_manual_review |
| WRIR Richmond Music Department Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized music submission, playlist-pitching, curator campaign, playlist marketplace, physical-mail or Music Department workflows, but all require manual review because they include account/login boundaries, release-timing constraints, one-song pitch rules, optional paid campaign/credit routes, business-contact handling, protected-contact handling, physical package preparation, genre/show targeting, rights and metadata review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no routes were activated, no forms were submitted, no messages were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no campaign was activated, no playlist was selected, no paid add-ons or credits were purchased, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run99PlatformSeeds.ts
- data/run99-platform-database.json
- data/run99-review-queue.csv
- data/run99-analytics-dashboard.json
- reports/2026-07-03-run-99.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 99 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
