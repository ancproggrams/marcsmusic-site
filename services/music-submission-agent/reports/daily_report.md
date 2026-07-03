# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 85

Run 85 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 485 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 3 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 2 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WERS Wicked Local Wednesday Submit Music Form | needs_manual_review |
| Radio Milwaukee Music Submission Route | needs_manual_review |
| WTJU 91.1 FM Genre Music Director Submission Route | needs_manual_review |
| WYEP Pittsburgh Area Music Submissions Route | needs_manual_review |
| KZSU Stanford 90.1 FM Music Director Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission, airplay, music-director, physical-mail and local-music routes, but all require manual review because they involve upload forms, official music-submission guidelines, genre music-director email routing, physical package choices, local eligibility requirements, file-format and file-size constraints, radio-edit/FCC-clean checks, cookie/secure-session controlled guideline access, artist context, metadata, rights/originality assertions and human station/editorial fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion routes were activated, no CAPTCHA/reCAPTCHA/Turnstile/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run85PlatformSeeds.ts
- data/run85-platform-database.json
- data/run85-review-queue.csv
- data/run85-analytics-dashboard.json
- reports/2026-07-03-run-85.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
