# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 33

Run 33 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 225 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 3 |
| Public contact forms observed | 1 |
| CAPTCHA/reCAPTCHA-protected routes observed | 1 |
| Login/social-account routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| CKUW 95.9 FM Winnipeg Music Director Submission Route | needs_manual_review |
| CIUT 89.5 FM Toronto New Music Submission Route | needs_manual_review |
| WRAS Album 88 Atlanta Regular Rotation Submission Route | needs_manual_review |
| KVMR Music Department and Broadcaster Contact Review Route | needs_manual_review |
| Thomann Beatmaking Contest 2026 Public Hashtag Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve Music Director/new-music email outreach, radio-clean asset checks, release-window fit, rights and ownership review, public social-post contest rules, reCAPTCHA-protected contact forms and/or social-platform login. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no social posts were created, no payments were attempted, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run33PlatformSeeds.ts`
- `data/run33-platform-database.json`
- `data/run33-review-queue.csv`
- `data/run33-analytics-dashboard.json`
- `reports/2026-07-01-run-33.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
