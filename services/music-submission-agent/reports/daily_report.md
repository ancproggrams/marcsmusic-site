# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 87

Run 87 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 495 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 4 |
| Official public physical-mail routes observed | 3 |
| Public application/upload/contact forms observed | 0 |
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
| SomaFM Digital Airplay Submission Route | needs_manual_review |
| WRTC-FM Trinity College Music Director and Genre Coordinator Route | needs_manual_review |
| WMFO Tufts Freeform Music Department Submission Route | needs_manual_review |
| WESU 88.1FM Music Directors Submission Route | needs_manual_review |
| WXYC 89.3FM Music Department Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission, airplay, music-director, genre-coordinator, Music Department, physical-mail and digital-download-link workflows, but all require manual review because they involve public Music Director emails, channel-specific routing, physical Music Department mailing, Bandcamp/YUM/WeTransfer/Dropbox/Google Drive/streaming-link handling, no-attachment guidance, no-AI policy checks, genre/channel selection, metadata, rights/originality assertions, FCC-clean/radio-edit or clean/explicit labeling and human station/editorial fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments or paid promotion routes were activated, no CAPTCHA/reCAPTCHA/Turnstile/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run87PlatformSeeds.ts
- data/run87-platform-database.json
- data/run87-review-queue.csv
- data/run87-analytics-dashboard.json
- reports/2026-07-03-run-87.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
