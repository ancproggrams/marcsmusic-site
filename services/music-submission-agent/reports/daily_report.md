# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 111

Run 111 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 615 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 3 |
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account or session-boundary routes observed | 2 |
| Challenge/session-boundary routes observed | 2 |
| External/manual workflow routes observed | 5 |
| Redacted contact routes observed | 1 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| CJSR Edmonton Album EP Digital and Physical Music Department Submission Route | needs_manual_review |
| CJSF 90.1FM NCRA Earshot Distro and Music Coordinator Submission Route | needs_manual_review |
| Earshot Distro Canadian Campus Community Radio Upload Route | needs_manual_review |
| RTRFM Submit Your Music Form Email and Physical Side Route | needs_manual_review |
| Triple J Unearthed Independent Australian Artist Upload Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized radio and music-distribution workflows, but all require manual review because they involve album/EP-only rules, digital package preparation, durable download links, physical package handling, broadcast-rights authorization, account/login/payment boundaries, Australian-artist eligibility review, public form/file-upload fields, release timing, rights metadata and one redacted public-contact boundary. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no challenge or session controls were handled, no redacted contact text was resolved, no contacts were guessed and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run111PlatformSeeds.ts
- data/run111-platform-database.json
- data/run111-review-queue.csv
- data/run111-analytics-dashboard.json
- reports/2026-07-04-run-111.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts direct loader update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 111 seeds are loaded directly through `seedPlatforms.ts`, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
