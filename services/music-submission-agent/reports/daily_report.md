# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 91

Run 91 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 515 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| PBS 106.7FM Submit Your Music Form | needs_manual_review |
| 2SER Submit Music for Airplay Consideration Form | needs_manual_review |
| Triple R 102.7FM Submit Music Route | needs_manual_review |
| FBi Radio Music Submissions Route | needs_manual_review |
| 4ZZZ Music Submissions Form | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and airplay-consideration workflows, but all require manual review because they involve digital forms, official public music/business email routes, physical-mail options, an external Music Department form route, a CAPTCHA case, a paid-promotion side-route that must remain separate, email copy, metadata, download-link permissions, high-quality MP3/WAV-equivalent checks, no-expiry download links, physical package preparation, presenter or station targeting and human station/library fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments or paid promotion routes were activated, no CAPTCHA/reCAPTCHA/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run91PlatformSeeds.ts
- data/run91-platform-database.json
- data/run91-review-queue.csv
- data/run91-analytics-dashboard.json
- reports/2026-07-03-run-91.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
