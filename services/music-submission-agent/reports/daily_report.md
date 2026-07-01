# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 46

Run 46 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 290 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 5 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected-contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WREK Atlanta Music Submissions | needs_manual_review |
| KFJC 89.7FM For Musicians | needs_manual_review |
| WMBR 88.1 FM MIT Your Music | needs_manual_review |
| KSPC 88.7FM Music Submissions | needs_manual_review |
| KXLU 88.9 FM Los Angeles Music Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve email/download-link workflows, physical-media routing, incomplete or station-specific ingest instructions, DJ/freeform programming fit, FCC-clean requirements, no-singles/no-demos/no-digital-only restrictions, AI/originality policy checks, protected-contact handling, anti-bot-safe contact form handling, metadata and package preparation. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run46PlatformSeeds.ts
- data/run46-platform-database.json
- data/run46-review-queue.csv
- data/run46-analytics-dashboard.json
- reports/2026-07-01-run-46.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
