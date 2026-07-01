# Music Submission Agent - Daily Report

Date: 2026-07-01

## Latest run: Run 37

Run 37 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 245 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 3 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public music/business email routes observed | 1 |
| Public application/upload forms observed | 5 |
| Payment routes observed | 2 |
| Login/member/account routes observed | 5 |
| CAPTCHA/bot-protection routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Jamendo Artist Upload and Licensing | needs_manual_review |
| Free Music Archive / Tribe of Noise Curated Upload | needs_manual_review |
| Audiomack Creator Upload | needs_manual_review |
| Bandcamp Artist Release Upload | needs_manual_review |
| SoundClick Artist and Beat Producer Upload | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve account registration or artist onboarding, upload permissions, license selection, Creative Commons/PRO rights checks, catalog suitability, payout/payment settings, explicit-content metadata, release artwork, copyright/fingerprint checks, moderation rules, AI/originality policy checks and owner-approved profile or pitch copy. No route in this batch exposed a safe complete public auto-submit form.

## Safety summary

No accounts were created, no messages were sent, no forms were submitted, no files were uploaded, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run37PlatformSeeds.ts
- data/run37-platform-database.json
- data/run37-review-queue.csv
- data/run37-analytics-dashboard.json
- reports/2026-07-01-run-37.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
