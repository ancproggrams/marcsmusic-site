# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 115

Run 115 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 635 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 2 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 3 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 4 |
| Login/member/account or session-boundary routes observed | 5 |
| CAPTCHA/challenge routes observed | 0 |
| JavaScript/app-session boundary routes observed | 2 |
| Validation-field routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Redacted contact routes observed | 0 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| RouteNote Free and Premium Digital Music Distribution Route | needs_manual_review |
| Audiomack Creator Upload and Free Limitless Music Discovery Route | needs_manual_review |
| CD Baby Worldwide Music Distribution Paid Release Submission Route | needs_manual_review |
| TuneCore Unlimited Digital Music Distribution Account Submission Route | needs_manual_review |
| LANDR Distribution Release Wizard and Playlist Pitching Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized global workflows, but all require manual review because they involve account/session boundaries, app or JavaScript routes, upload/release configuration, pricing or payment settings, metadata, rights and licensing checks, payout/splits, store delivery, playlist-pitching or monetization choices. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no release flows were started, no messages or emails were sent, no files were transferred, no private links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no JavaScript/app/session controls were handled beyond public page discovery, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run115PlatformSeeds.ts
- data/run115-platform-database.json
- data/run115-review-queue.csv
- data/run115-analytics-dashboard.json
- reports/2026-07-04-run-115.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts direct loader update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 115 seeds are loaded directly through `seedPlatforms.ts`, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
