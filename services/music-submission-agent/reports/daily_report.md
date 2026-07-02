# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 64

Run 64 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 380 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 0 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 4 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Soundplate Play Spotify and Deezer Playlist Submissions | needs_manual_review |
| Spinnin' Records Talent Pool Demo Dashboard | needs_manual_review |
| Spotify for Artists Editorial Playlist Pitching | needs_manual_review |
| Mixcloud Creator Upload and Discovery Platform | needs_manual_review |
| Vampr Publishing Sync and Artist Network Opportunities | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public playlist, label-demo, editorial-pitching, creator-upload and artist-opportunity workflows, but all require manual review because they involve playlist/curator or label-fit decisions, account/login dashboards, unreleased-track or catalog eligibility checks, track/upload/link preparation, metadata and pitch copy, rights/originality assertions, anti-spam compliance, public/private or monetization choices, optional premium/distribution side routes and platform terms acceptance. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run64PlatformSeeds.ts
- data/run64-platform-database.json
- data/run64-review-queue.csv
- data/run64-analytics-dashboard.json
- reports/2026-07-02-run-64.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
