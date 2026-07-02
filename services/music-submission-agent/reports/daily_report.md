# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 77

Run 77 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 445 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 3 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 1 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 2 |
| Login/member/account routes observed | 2 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Soho Radio Music Submission | needs_manual_review |
| NTS Radio Show Proposal Form | needs_manual_review |
| Groover Paid Music Promotion Submission Platform | needs_manual_review |
| Musosoup Artist Campaign Submission | needs_manual_review |
| Soundplate Free Playlist Submission System | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public independent-radio, radio-show-proposal, paid/freemium promotion, curator marketplace, playlist-submission, contact-form, app-upload and music-submission-email routes, but all require manual review because they involve outbound email, public form or app completion, account/login or payment approval in some cases, anti-bot/request verification in one case, playlist or curator selection, track/link permissions, metadata, release context, clean/explicit labeling, rights/originality assertions and station/editorial/playlist fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no anti-bot or validation controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run77PlatformSeeds.ts
- data/run77-platform-database.json
- data/run77-review-queue.csv
- data/run77-analytics-dashboard.json
- reports/2026-07-02-run-77.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
