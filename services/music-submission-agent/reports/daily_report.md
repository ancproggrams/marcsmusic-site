# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 59

Run 59 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 355 |
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
| Payment/payment-option side routes observed | 2 |
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
| RTRFM 92.1 Perth Submit Your Music | needs_manual_review |
| FBi Radio Sydney Music Submissions | needs_manual_review |
| Triple R 102.7FM Melbourne Submit Music | needs_manual_review |
| Edge Radio 99.3FM Hobart Submit Your Music | needs_manual_review |
| Radio Adelaide Submit Your Music | needs_manual_review |

## Manual-review reasons

The latest routes are free-first but still require human review because they involve public form handling, biography upload, digital package preparation, email/cloud-link preparation, release-timing claims, direct-presenter or program-routing choices, no-login stream links, 320kbps MP3 or WAV download requirements, 44.1kHz stereo 16-bit WAV preferences, physical mail/drop-off options, local-priority or Tasmanian/South Australian marking, focus-track selection, presenter/program/station fit checks and metadata and rights/originality assertions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run59PlatformSeeds.ts
- data/run59-platform-database.json
- data/run59-review-queue.csv
- data/run59-analytics-dashboard.json
- reports/2026-07-02-run-59.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
