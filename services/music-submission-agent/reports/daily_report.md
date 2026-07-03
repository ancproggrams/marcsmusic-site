# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 86

Run 86 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 490 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 1 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 3 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WCBN-FM Ann Arbor Music Director Hard-Copy Submission Route | needs_manual_review |
| WUAG 103.1 at UNCG Music Submission Form | needs_manual_review |
| KRCL 90.9FM How to Submit Music | needs_manual_review |
| The Line of Best Fit New and Unsigned Artists Submission Form | needs_manual_review |
| Obscure Sound Contact and Submissions Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission, airplay, music-director, physical-mail, upload-form, Google Form, music blog and editorial-submission routes, but all require manual review because they involve hard-copy music-director routing, file uploads or downloadable-file links, storage-link permission checks, optional Google session handling, protected/redacted or obfuscated contacts, direct email subject-line requirements, physical package choices, genre/local eligibility routing, FCC-clean/radio-edit checks, one-track limits, artist context, metadata, rights/originality assertions, paid side-route owner approval and human station/editorial fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no physical mail was sent, no payments or paid promotion/PR routes were activated, no CAPTCHA/reCAPTCHA/Turnstile/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run86PlatformSeeds.ts
- data/run86-platform-database.json
- data/run86-review-queue.csv
- data/run86-analytics-dashboard.json
- reports/2026-07-03-run-86.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
