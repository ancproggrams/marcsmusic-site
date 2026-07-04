# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 116

Run 116 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 640 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 1 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 2 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 5 |
| Login/member/account or session-boundary routes observed | 5 |
| CAPTCHA/challenge routes observed | 0 |
| JavaScript/app-session boundary routes observed | 3 |
| Validation-field routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Redacted contact routes observed | 0 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| DistroKid Digital Distribution and DistroVid Submission Route | needs_manual_review |
| SoundCloud for Artists Upload Promotion and Monetization Route | needs_manual_review |
| ReverbNation Artist Opportunities and Profile Submission Route | needs_manual_review |
| UnitedMasters Independent Artist Release and Brand Opportunity Route | needs_manual_review |
| Amuse Self-Service Distribution and Artist Services Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized global workflows, but all require manual review because they involve account access, app/session routes, release configuration, pricing or payment settings, rights and metadata checks, store delivery, promotional/opportunity selection, royalty/splits, Content ID, video-distribution or monetization choices.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no opportunities were selected, no release flows were started, no messages or emails were sent, no files were uploaded or transferred, no private/download links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no CAPTCHA/session controls were interacted with, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run116PlatformSeeds.ts
- data/run116-platform-database.json
- data/run116-review-queue.csv
- data/run116-analytics-dashboard.json
- reports/2026-07-04-run-116.md
- reports/daily_report.md
- src/discovery/run113PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 116 seeds are loaded through the existing Run 113 aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
