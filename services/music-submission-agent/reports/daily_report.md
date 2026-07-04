# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 106

Run 106 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 590 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 2 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account or session-boundary routes observed | 0 |
| CAPTCHA/session-boundary routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| EQ Music Blog New Music Tip and Promo Submission Route | needs_manual_review |
| Nialler9 Music Promo and Premiere Submission Route | needs_manual_review |
| LOUD WOMEN Reviews Editor and Radio Form Submission Route | needs_manual_review |
| Get In Her Ears Website and Soho Radio Pitch Submission Route | needs_manual_review |
| musicOMH Album Feature and Review Pitch Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized music blog, zine, radio-show, editorial, album-review, feature/interview, email, physical-promo and external-form workflows, but all require manual review because they involve route-specific editorial fit, eligibility checks, release timing, clean asset preparation, streaming/download link permissions, physical package handling, external Google Form boundaries and two protected/redacted email cases. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected or redacted contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run106PlatformSeeds.ts
- data/run106-platform-database.json
- data/run106-review-queue.csv
- data/run106-analytics-dashboard.json
- reports/2026-07-04-run-106.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts direct loader update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 106 seeds are loaded directly through `seedPlatforms.ts`, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
