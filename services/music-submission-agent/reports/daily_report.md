# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 60

Run 60 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 360 |
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
| KOPN 89.5FM Artist Submissions | needs_manual_review |
| KAOS 89.3FM Olympia Submit Music | needs_manual_review |
| WTJU 91.1FM Submit Music | needs_manual_review |
| WMNF 88.5FM Tampa Submit Your Music | needs_manual_review |
| WMPG 90.9FM Music Department Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve physical package preparation, professional-CD restrictions, no-CD-R/no-demo/no-single rules, digital download-link handling, MP3/WAV accepted-format checks, form completion, file upload fields, subject-line genre tagging, local/Tampa or Pacific Northwest eligibility claims, clean-language/FCC notes, metadata and rights/originality assertions, genre-director targeting and DJ/program/station-fit checks. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run60PlatformSeeds.ts
- data/run60-platform-database.json
- data/run60-review-queue.csv
- data/run60-analytics-dashboard.json
- reports/2026-07-02-run-60.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
