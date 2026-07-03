# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 93

Run 93 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 525 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 1 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Fresh On The Net Send Us A Track Listening Post Route | needs_manual_review |
| Resonance FM Promos and Programme Maker Submission Route | needs_manual_review |
| Louder Than War New Artists and New Releases Submission Route | needs_manual_review |
| God Is In The TV Contact Form and New Music Submission Route | needs_manual_review |
| NARC Magazine Submission Guidelines and Contact Form Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and coverage-consideration workflows, but all require manual review because they include one weekly open-window submission inbox, official public music/business email routes, one physical-promo route, public contact/submission forms, one visible login/register boundary that must not be used, one contact form with anti-spam/privacy controls, one protected/redacted contact case, pitch copy, release lead time, track-count/no-AI eligibility, editor/programme fit, regional fit and human publication/radio review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments were activated, no CAPTCHA/reCAPTCHA/session/privacy controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run93PlatformSeeds.ts
- data/run93-platform-database.json
- data/run93-review-queue.csv
- data/run93-analytics-dashboard.json
- reports/2026-07-03-run-93.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 93 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
