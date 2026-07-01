# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 56

Run 56 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 340 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 1 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option routes observed | 0 |
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
| KRCL 90.9FM Salt Lake City How to Submit Music | needs_manual_review |
| Radio Milwaukee 88Nine Music Submission | needs_manual_review |
| WNXP 91.1FM Nashville Music Submissions | needs_manual_review |
| KGNU Community Radio Contact Staff or DJ Music Department | needs_manual_review |
| WFUV New York Send Music to Music Department | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve physical mail, external Google Form upload routing, WAV/download-link preparation, clean radio edit requirements, music-department or DJ routing, station-fit checks, metadata and rights/originality assertions, reCaptcha v3 and phone/mail workflows. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update. The KGNU reCaptcha route was recorded as manual-only.

## Artifacts produced

- src/discovery/run56PlatformSeeds.ts
- data/run56-platform-database.json
- data/run56-review-queue.csv
- data/run56-analytics-dashboard.json
- reports/2026-07-01-run-56.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
