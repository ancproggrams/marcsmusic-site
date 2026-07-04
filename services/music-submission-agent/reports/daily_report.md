# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 107

Run 107 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 595 |
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
| Public application/upload/contact forms observed | 3 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account or session-boundary routes observed | 0 |
| CAPTCHA/session-boundary routes observed | 3 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| FBi Radio Music Submissions Email Route | needs_manual_review |
| PBS 106.7FM Submit Your Music Form and Music Department Route | needs_manual_review |
| 4ZZZ Music Department Airplay and Album of the Week Form Route | needs_manual_review |
| Triple R 102.7FM Submit Music Email and Physical Route | needs_manual_review |
| 2SER Submit Your Music Airplay Consideration Form Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized Australian community and independent radio submission workflows, but all require manual review because they involve route-specific station fit, presenter or music-department targeting, clean pitch preparation, stream/download link permissions, high-quality audio requirements, CAPTCHA handling, external-form boundaries, and physical package handling. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected or redacted contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run107PlatformSeeds.ts
- data/run107-platform-database.json
- data/run107-review-queue.csv
- data/run107-analytics-dashboard.json
- reports/2026-07-04-run-107.md
- reports/daily_report.md
- src/discovery/seedPlatforms.ts direct loader update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 107 seeds are loaded directly through `seedPlatforms.ts`, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
