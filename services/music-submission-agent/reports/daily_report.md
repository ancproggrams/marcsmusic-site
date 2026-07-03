# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 82

Run 82 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 470 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 1 |
| Freemium/manual routes in latest run | 3 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 1 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 4 |
| Login/member/account routes observed | 4 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| TAXI Independent A&R Industry Listings | needs_manual_review |
| Sonicbids Artist Gig and EPK Opportunity Submissions | needs_manual_review |
| Songtradr Music Licensing Marketplace Upload Route | needs_manual_review |
| Nialler9 Music Promo and Release Submission Route | needs_manual_review |
| LabelRadar Artist Demo Submission Platform | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public A&R, gig/EPK, sync-licensing, music-blog and demo-submission routes, but all require manual review because they involve membership or account creation, login/session handling, JavaScript app interaction, protected contact handling, paid membership or pricing approval, opportunity or label targeting, track/demo upload, metadata and pitch copy, rights/originality assertions, AI-use policy checks, release timing, no-attachment compliance and human editorial, A&R, sync, promoter or label-fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run82PlatformSeeds.ts
- data/run82-platform-database.json
- data/run82-review-queue.csv
- data/run82-analytics-dashboard.json
- reports/2026-07-03-run-82.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
