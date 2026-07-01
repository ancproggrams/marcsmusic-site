# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 51

Run 51 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 315 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 4 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KEXP Seattle Music Director Airplay Consideration | needs_manual_review |
| WXPN 88.5 Music Director and Local Show Submissions | needs_manual_review |
| KALX 90.7FM Berkeley Physical Music Submissions | needs_manual_review |
| UKF / Pilot Submit Your Demo | needs_manual_review |
| KFAI Minneapolis Music Department and Music Library | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve Music Director or Music Library email routes, public demo forms, physical-only media mailing, protected/redacted contact handling, EPK and download-link packaging, WAV/MP3 quality checks, clean/explicit review, DJ/show or local-show targeting, rights/licensing review, station/label fit and release metadata validation. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run51PlatformSeeds.ts
- data/run51-platform-database.json
- data/run51-review-queue.csv
- data/run51-analytics-dashboard.json
- reports/2026-07-01-run-51.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
