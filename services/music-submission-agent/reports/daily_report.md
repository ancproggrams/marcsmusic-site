# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 57

Run 57 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 345 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 1 |
| Official public physical-mail routes observed | 3 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 2 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WERS 88.9FM Wicked Local Wednesday Submit Music | needs_manual_review |
| KBOO Portland Submit Your Music | needs_manual_review |
| CKUA Radio Getting Airplay | needs_manual_review |
| PBS 106.7FM Melbourne Submit Your Music | needs_manual_review |
| 4ZZZ Brisbane Music Submissions | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve local-only eligibility, audio file upload or download-link preparation, physical mail, digital submission forms, external JavaScript form routing, CAPTCHA or reCAPTCHA protection, clean/radio edit requirements, no-Spotify/no-Deezer or downloadable-link restrictions, genre/programmer/presenter routing, station-fit checks and metadata and rights/originality assertions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update. WERS and PBS CAPTCHA/reCAPTCHA routes were recorded as manual-only.

## Artifacts produced

- src/discovery/run57PlatformSeeds.ts
- data/run57-platform-database.json
- data/run57-review-queue.csv
- data/run57-analytics-dashboard.json
- reports/2026-07-01-run-57.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
