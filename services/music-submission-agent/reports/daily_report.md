# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 36

Run 36 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 240 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 2 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 3 |
| Official public music/business email routes observed | 1 |
| Public application/upload forms observed | 5 |
| Payment routes observed | 3 |
| Login/member/account routes observed | 3 |
| CAPTCHA/bot-protection routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Sofar Sounds Artist Application | needs_manual_review |
| Unsigned Only Music Awards Online Entry | needs_manual_review |
| Great American Song Contest 2026 Online Submission | needs_manual_review |
| John Lennon Songwriting Contest 2026 Session Entry | needs_manual_review |
| Subvert Founding Artist or Label Membership | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve account registration or member onboarding, upload/payment workflows, contest category selection, deadline checks, artist eligibility, AI/originality policies, rights/ownership confirmation, live-performance fit, city availability, PayPal/credit purchase flows, anti-bot controls and owner-approved profile or pitch copy. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run36PlatformSeeds.ts
- data/run36-platform-database.json
- data/run36-review-queue.csv
- data/run36-analytics-dashboard.json
- reports/2026-07-01-run-36.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
