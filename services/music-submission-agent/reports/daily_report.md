# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 39

Run 39 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 255 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 2 |
| Public application/upload forms observed | 3 |
| Payment routes observed | 0 |
| Login/member/account routes observed | 2 |
| CAPTCHA/bot-protection routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KALX 90.7FM Berkeley Music Submissions | needs_manual_review |
| KEXP Rotation Consideration | needs_manual_review |
| Monstercat Demo Submission | needs_manual_review |
| Spinnin Records Talent Pool | needs_manual_review |
| Armada Music Demo Drop | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve physical-media-only radio submission, official music-director email curation, external LabelRadar demo submission, login-required demo upload, dynamic demo-drop inspection, rights ownership review, clean-edit checks, metadata review, account/terms review and label or station fit assessment. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run39PlatformSeeds.ts
- data/run39-platform-database.json
- data/run39-review-queue.csv
- data/run39-analytics-dashboard.json
- reports/2026-07-01-run-39.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
