# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 97

Run 97 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 545 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 2 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 2 |
| Login/member/account routes observed | 2 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Soundplate Play Free Spotify and Deezer Playlist Submission Route | needs_manual_review |
| KXCI Tucson Music Department Digital and Physical Submission Route | needs_manual_review |
| KUTX Austin On-Air Rotation Music Submission Route | needs_manual_review |
| Audiomack Free Creator Upload and Trending Consideration Route | needs_manual_review |
| Groover Paid Curator and Music Pro Pitch Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission, upload, playlist, airplay or paid curator-pitch workflows, but all require manual review because they include playlist-fit and anti-spam rules, one protected/redacted contact case, one official physical-mail route, two official public music/business email routes, four public application/upload/contact workflows, two login/account boundaries, one paid manual-only route, two payment/payment-option side routes, clean/radio-edit checks, upload/rights/metadata checks, route/genre targeting and human editorial/radio/curator review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no routes were activated, no playlist was selected, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments or credits were purchased, no CAPTCHA, validation or session controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run97PlatformSeeds.ts
- data/run97-platform-database.json
- data/run97-review-queue.csv
- data/run97-analytics-dashboard.json
- reports/2026-07-03-run-97.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 97 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
