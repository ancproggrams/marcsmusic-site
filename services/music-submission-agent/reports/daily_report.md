# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 43

Run 43 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 275 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Public application/upload forms observed | 3 |
| Payment routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| Protected-contact routes observed | 3 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| RTRFM 92.1 Perth Submit Your Music | needs_manual_review |
| Edge Radio 99.3FM Hobart Submit Your Music | needs_manual_review |
| Three D Radio 93.7FM Adelaide Submit Your Music | needs_manual_review |
| Radio Adelaide Submit Your Music | needs_manual_review |
| 4ZZZ Brisbane Music Submissions | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve public forms, protected public route links, dynamic/JavaScript form behavior, downloadable audio-link rules, MP3/WAV format requirements, no-attachment rules, physical-route options, local/Australian music context, program-fit review and rights checks. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no files were uploaded, no physical mail or hand-delivery was attempted, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run43PlatformSeeds.ts
- data/run43-platform-database.json
- data/run43-review-queue.csv
- data/run43-analytics-dashboard.json
- reports/2026-07-01-run-43.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
