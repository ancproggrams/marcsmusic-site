# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 94

Run 94 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 530 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 2 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 2 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| 95bFM Submit Music Email Route | needs_manual_review |
| WFMU Send Music Music Director Review Route | needs_manual_review |
| KEXP Airplay Rotation Submission Guidelines Route | needs_manual_review |
| triple j Unearthed Artist Upload and Airplay Route | needs_manual_review |
| NTS Radio Mixtape Submission Call Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and airplay/coverage-consideration workflows, but all require manual review because they include one protected/redacted official public email route, one physical Music Director route, one JavaScript-required contact form, one detailed Music Director email workflow, one account-gated artist-profile upload flow, one eligibility-restricted national artist platform, one public Apply Now mixtape call whose static endpoint was not safely exposed, link/file permission checks, release timing, metadata, clean-edit/FCC checks, show or station fit and human editorial/radio review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments were activated, no CAPTCHA/reCAPTCHA/Turnstile/session controls were interacted with or bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run94PlatformSeeds.ts
- data/run94-platform-database.json
- data/run94-review-queue.csv
- data/run94-analytics-dashboard.json
- reports/2026-07-03-run-94.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 94 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
