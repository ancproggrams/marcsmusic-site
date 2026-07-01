# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 41

Run 41 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 265 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 3 |
| Public application/upload forms observed | 3 |
| Payment routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| Protected-contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KXT 91.7 Dallas Music Submissions | needs_manual_review |
| KUTX 98.9 Austin On-Air Rotation Music Submissions | needs_manual_review |
| WERS 88.9FM Wicked Local Wednesday Music Submission | needs_manual_review |
| WYEP 91.3 Pittsburgh Area Music Submissions | needs_manual_review |
| Toolroom Records Demo Submission | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve external public forms, local eligibility rules, Music Director email routing, local-show targeting, MP3/WAV download requirements, clean-edit checks, metadata review, rights ownership review, A&R package review, session/cookie validation and one reCAPTCHA-protected form. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run41PlatformSeeds.ts
- data/run41-platform-database.json
- data/run41-review-queue.csv
- data/run41-analytics-dashboard.json
- reports/2026-07-01-run-41.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
