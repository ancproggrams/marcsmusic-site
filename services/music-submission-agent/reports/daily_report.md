# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 54

Run 54 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 330 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 3 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option routes observed | 0 |
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
| WRSU 88.7FM Rutgers Music Director Submissions | needs_manual_review |
| WHUS 91.7FM UConn New Music Committee | needs_manual_review |
| WESU 88.1FM Middletown Music Directors | needs_manual_review |
| WXYC 89.3FM UNC Music Department | needs_manual_review |
| WUOG 90.5FM Athens Submit Music | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve Music Director email routes, physical-mail package options, links-only or album/package requirements, station-fit checks, local/live-show or freeform-radio targeting, metadata and rights review, clean/explicit content review, public-contact validation and one generic station contact form that was identified but not used. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run54PlatformSeeds.ts
- data/run54-platform-database.json
- data/run54-review-queue.csv
- data/run54-analytics-dashboard.json
- reports/2026-07-01-run-54.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
