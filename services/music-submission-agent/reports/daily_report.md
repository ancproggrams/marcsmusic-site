# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 92

Run 92 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 520 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 1 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| CJSR 88.5 FM Submit Music Route | needs_manual_review |
| CFUV 101.9 FM Music Submissions Route | needs_manual_review |
| CJAM 99.1 FM Digital Music Submission Route | needs_manual_review |
| CFRU 93.3 FM Music Department Submission Route | needs_manual_review |
| Radio Western 94.9 FM Music Submission Email Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and airplay-consideration workflows, but all require manual review because they involve official public music/business email routes, physical mail/drop-off options, one local upload/download-link form, one programmer-only login resource that must not be used, one paid local-advertising side-route that must remain separate from free editorial/radio submission, email copy, metadata, album/EP and track-count eligibility, ID3 tags, language warnings, download-link permissions, no-expiry link checks, physical package preparation, local eligibility and human station/library fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments or paid advertising routes were activated, no CAPTCHA/reCAPTCHA/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run92PlatformSeeds.ts
- data/run92-platform-database.json
- data/run92-review-queue.csv
- data/run92-analytics-dashboard.json
- reports/2026-07-03-run-92.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 92 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
