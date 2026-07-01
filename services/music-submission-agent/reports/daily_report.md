# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 53

Run 53 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 325 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 2 |
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
| KCSB-FM Santa Barbara Artist Inquiry | needs_manual_review |
| WNCW 88.7 Submit Music | needs_manual_review |
| WYEP Pittsburgh Area Music Submissions | needs_manual_review |
| KUTX Austin Submit Your Music | needs_manual_review |
| KXT 91.7 Dallas Music Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve external Google/Wufoo forms, Music Director email routes, digital WAV/download-link packaging, physical-mail options, local/regional eligibility checks, one-song or track-selection constraints, specialty-show targeting, FCC-clean/content review, rights/licensing review, station fit and public-contact validation. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run53PlatformSeeds.ts
- data/run53-platform-database.json
- data/run53-review-queue.csv
- data/run53-analytics-dashboard.json
- reports/2026-07-01-run-53.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
