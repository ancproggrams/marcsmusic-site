# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 81

Run 81 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 465 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 2 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 0 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 3 |
| Login/member/account routes observed | 5 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Spotify for Artists Playlist Pitching | needs_manual_review |
| DropTrack Artist and Label Targeted Submissions | needs_manual_review |
| Amazing Radio Artist Upload Route | needs_manual_review |
| Music Xray Song Opportunity Submissions | needs_manual_review |
| SubmitHub Curator Submission Platform | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public playlisting, music-promotion, emerging-artist radio, A&R/opportunity and curator-submission routes, but all require manual review because they involve authenticated artist/team access, account creation, JavaScript app interaction, curator/opportunity selection, track upload or release selection, metadata and pitch copy, release timing, rights/originality assertions, paid-credit or fee approval, platform terms review and editorial/curator/radio/industry fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no validation controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run81PlatformSeeds.ts
- data/run81-platform-database.json
- data/run81-review-queue.csv
- data/run81-analytics-dashboard.json
- reports/2026-07-03-run-81.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
