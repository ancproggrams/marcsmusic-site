# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 35

Run 35 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 235 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 4 |
| Public upload forms observed | 1 |
| Physical submission routes observed | 3 |
| CAPTCHA/validation-protected routes observed | 0 |
| Login/social-account routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WMNF 88.5 FM Submit Your Music Form | needs_manual_review |
| WWOZ Getting Airplay Music Director Route | needs_manual_review |
| KDVS 90.3 FM Music Department Physical Submission Route | needs_manual_review |
| KAOS 89.3FM Olympia Submit Music Route | needs_manual_review |
| KMNR 89.7 FM Music Director Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve uploaded audio files, physical media decisions, one-sheets/press releases, clean/radio-safe metadata, rights/originality checks, FCC/profanity notes, physical mailing/drop-off routes, station/show fit and owner-approved outreach copy. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run35PlatformSeeds.ts
- data/run35-platform-database.json
- data/run35-review-queue.csv
- data/run35-analytics-dashboard.json
- reports/2026-07-01-run-35.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
