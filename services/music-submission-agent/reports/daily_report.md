# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 89

Run 89 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 505 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 0 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account routes observed | 5 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Monstercat Uncaged Instinct Silk LabelRadar Demo Submission Route | needs_manual_review |
| Spinnin Records Talent Pool Demo Upload Route | needs_manual_review |
| STMPD RCRDS SoundCloud Demo Drop Route | needs_manual_review |
| Revealed Recordings Account-Gated Demo Submission Route | needs_manual_review |
| NCS LabelRadar Demo Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and demo-submission workflows, but all require manual review because they involve external LabelRadar sessions, account-gated demo upload, SoundCloud login/connect, email/password or Spotify sign-in, possible Pro/payment side-route review, track-link or upload delivery, release metadata, original-work and rights/originality assertions, no-remix/no-bootleg compliance, copyright-free usage implications, terms acceptance and human label fit review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments or paid promotion routes were activated, no CAPTCHA/reCAPTCHA/Turnstile/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run89PlatformSeeds.ts
- data/run89-platform-database.json
- data/run89-review-queue.csv
- data/run89-analytics-dashboard.json
- reports/2026-07-03-run-89.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
