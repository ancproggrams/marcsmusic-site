# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 90

Run 90 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 510 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 1 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WXDU 88.7 FM Music Airplay Submission Route | needs_manual_review |
| KTRU 96.1 FM Physical Music Submission Route | needs_manual_review |
| WHPK 88.5 FM Music Submissions Contact Route | needs_manual_review |
| WICB 91.7 FM Submit Music Route | needs_manual_review |
| KCRW Music Airplay Recording Consideration Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and airplay-consideration workflows, but all require manual review because they involve email copy, physical package preparation, Bandcamp YUM-code or download-link selection, metadata, clean/explicit labeling, local/regional eligibility, specialty or programmer routing, possible contact-form completion and human station/library fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments or paid promotion routes were activated, no CAPTCHA/reCAPTCHA/Turnstile/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run90PlatformSeeds.ts
- data/run90-platform-database.json
- data/run90-review-queue.csv
- data/run90-analytics-dashboard.json
- reports/2026-07-03-run-90.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
