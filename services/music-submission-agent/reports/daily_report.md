# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 96

Run 96 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 540 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 5 |
| Official public physical-mail routes observed | 4 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| CJSW Calgary Digital Music Submission Upload Route | needs_manual_review |
| CKUT 90.3FM Music Department Physical and Digital Submission Route | needs_manual_review |
| WMBR MIT Physical Music Director and Genre Contact Route | needs_manual_review |
| WMSE 91.7FM Music Department Submission Route | needs_manual_review |
| WRPI Troy Music Director Contact and Station Mail Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public music-submission and airplay/coverage-consideration workflows, but all require manual review because they include two protected/redacted contact cases, four physical-mail or package-prep routes, five official public music/business email or department routes, two public upload/contact-form routes, one CAPTCHA form case, one external Jotform upload workflow, one digital-album-only/no-singles route, one route with recent-release and three-track minimum rules, one physical-preferred route, one route with FCC-clean checks, route/genre targeting, metadata checks and human editorial/radio review. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no route was activated, no forms were submitted, no emails were sent, no files were uploaded or transferred, no download links were delivered, no storage permissions were changed, no physical mail was sent, no payments were activated, no CAPTCHA, validation or session controls were interacted with, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run96PlatformSeeds.ts
- data/run96-platform-database.json
- data/run96-review-queue.csv
- data/run96-analytics-dashboard.json
- reports/2026-07-03-run-96.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 96 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
