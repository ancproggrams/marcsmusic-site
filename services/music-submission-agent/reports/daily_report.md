# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 62

Run 62 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 370 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 2 |
| Freemium/manual routes in latest run | 3 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 0 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 2 |
| Login/member/account routes observed | 4 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WFMU Send Us Music | needs_manual_review |
| Bandcamp for Artists | needs_manual_review |
| Jamendo Artists Services | needs_manual_review |
| Newgrounds Audio Portal | needs_manual_review |
| SoundCloud Upload Your Music | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public submission, artist-service, community upload or physical-review routes, but all require manual review because they involve physical mailing, account/login flows, audio upload or catalog activation, metadata and artwork, pricing or payout choices, licensing/rights/originality assertions, explicit-content or clean-language labeling, optional paid-plan choices and platform/station-fit checks. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run62PlatformSeeds.ts
- data/run62-platform-database.json
- data/run62-review-queue.csv
- data/run62-analytics-dashboard.json
- reports/2026-07-02-run-62.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
