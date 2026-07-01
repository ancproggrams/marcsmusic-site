# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 47

Run 47 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 295 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 2 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| 95bFM Auckland Submit Music | needs_manual_review |
| Fresh On The Net Send Us A Track | needs_manual_review |
| dublab Radio Promotional Materials | needs_manual_review |
| NTS Radio Show Proposal | needs_manual_review |
| WFMU Send Music to WFMU | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve email/download-link workflows, weekly public SoundCloud submission forms, promotional-materials freeform routing, programmed radio-show proposal forms, physical-media review, release-window checks, WAV/FLAC or embeddable-link requirements, station/show fit, AI/originality policy checks, rights and metadata review, protected/redacted contact handling and package preparation. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run47PlatformSeeds.ts
- data/run47-platform-database.json
- data/run47-review-queue.csv
- data/run47-analytics-dashboard.json
- reports/2026-07-01-run-47.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
