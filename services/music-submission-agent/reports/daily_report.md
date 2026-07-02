# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 70

Run 70 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 410 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 4 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WNCW Submit Music | needs_manual_review |
| WXDU 88.7FM Music Submissions | needs_manual_review |
| WXYC 89.3FM Music Department Submissions | needs_manual_review |
| WUAG 103.1FM Music Submission Form | needs_manual_review |
| WUOG 90.5FM Submit Music | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public radio, college radio, campus radio and student-run alternative radio airplay/workflow routes, but all require manual review because they involve targeted email preparation, physical-vs-digital package selection, Bandcamp YUM-code or cloud-link/file prep, file upload/form handling, clean/FCC assertions, local-vs-general director route selection, metadata, rights/originality assertions and programming/station-fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run70PlatformSeeds.ts
- data/run70-platform-database.json
- data/run70-review-queue.csv
- data/run70-analytics-dashboard.json
- reports/2026-07-02-run-70.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
