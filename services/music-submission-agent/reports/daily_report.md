# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 52

Run 52 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 320 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 4 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 0 |
| Payment/payment-option routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| SomaFM Submit Music for Airplay | needs_manual_review |
| KVRX 91.7FM Austin Music Submissions | needs_manual_review |
| WUSB 90.1FM Stony Brook Music Director Submissions | needs_manual_review |
| KSCU 103.3FM Santa Clara Music Director Submissions | needs_manual_review |
| KZSC 88.1FM Santa Cruz Genre Music Directors | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve Music Director email routes, digital-download packaging, Bandcamp YUM/download-code or WeTransfer/Dropbox handling, physical-mail options, AI/originality policies, channel or genre-director targeting, protected/redacted contact handling, MP3 bitrate/metadata checks, clean/explicit review, rights/licensing review, station fit and public-contact validation. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run52PlatformSeeds.ts
- data/run52-platform-database.json
- data/run52-review-queue.csv
- data/run52-analytics-dashboard.json
- reports/2026-07-01-run-52.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
