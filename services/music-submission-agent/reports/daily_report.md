# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 42

Run 42 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 270 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 4 |
| Public application/upload forms observed | 2 |
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
| FBi Radio Sydney Music Submissions | needs_manual_review |
| 2SER 107.3FM Sydney Submit Your Music | needs_manual_review |
| PBS 106.7FM Melbourne Submit Your Music | needs_manual_review |
| Triple R 102.7FM Melbourne Submit Music | needs_manual_review |
| SYN Media Melbourne Music Submissions | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve official public music mailboxes, a public airplay-consideration form, a CAPTCHA-protected submit-music form, station/program targeting requirements, stream/download-link rules, no-attachment rules, local/Australian music context, clean-edit and rights review, physical-route options and runtime Mailgun/SMTP validation. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no hand-delivery was attempted, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run42PlatformSeeds.ts
- data/run42-platform-database.json
- data/run42-review-queue.csv
- data/run42-analytics-dashboard.json
- reports/2026-07-01-run-42.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
