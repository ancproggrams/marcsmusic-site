# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 123

Run 123 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 675 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 4 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 1 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 0 |
| Public application/upload/contact forms observed | 5 |
| Payment/payment-option side routes observed | 5 |
| Login/member/account or session-boundary routes observed | 5 |
| CAPTCHA/challenge routes observed | 0 |
| JavaScript/app-session boundary routes observed | 5 |
| Validation-field routes observed | 5 |
| External/manual workflow routes observed | 5 |
| Redacted/obfuscated contact routes observed | 0 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| RepostExchange Official SoundCloud Repost Campaign and Feedback Route | needs_manual_review |
| Hypeddit Music Promotion Download Gate Smart Link and Pre-Save Route | needs_manual_review |
| Radio Airplay Jango Internet Radio Upload Review Contest and Airplay Route | needs_manual_review |
| Play MPE Caster Radio Curator Supervisor and Media Release Promotion Route | needs_manual_review |
| Promoly DJ Tastemaker Promo Mailout Feedback and Smartlink Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized workflows, but all require manual review because they involve account/login or third-party app authorization, upload/link handling, track metadata, campaign or package setup, credit allocation, optional or required payment routes, contact/DJ/radio recipient targeting, fan-data capture, outbound promo sends and platform-fit review.

## Safety summary

No accounts were created, no login was used, no SoundCloud or third-party app authorization was granted, no forms were submitted, no campaigns were started, no curators, DJs, contacts, stations or playlists were selected, no messages or emails were sent, no files were uploaded or transferred, no streaming/download/private links were delivered, no payments or subscriptions were initiated, no CAPTCHA/challenge/session controls were handled, no protected or obfuscated contacts were decoded, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run123PlatformSeeds.ts
- data/run123-platform-database.json
- data/run123-review-queue.csv
- data/run123-analytics-dashboard.json
- reports/2026-07-04-run-123.md
- reports/daily_report.md
- src/discovery/run122PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 123 seeds are loaded through the Run 122 aggregation, which is already loaded through the Run 121, Run 120, Run 119, Run 118, Run 117 and Run 113 aggregations, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.