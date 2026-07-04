# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 121

Run 121 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 665 |
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
| CAPTCHA/challenge routes observed | 2 |
| JavaScript/app-session boundary routes observed | 0 |
| Validation-field routes observed | 2 |
| External/manual workflow routes observed | 5 |
| Redacted/obfuscated contact routes observed | 0 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Radio Milwaukee WAV Radio Edit Digital Music Submission Route | needs_manual_review |
| WFUV Music Department Snail Mail and Music Contact Airplay Route | needs_manual_review |
| WERS Wicked Local Wednesday Local Artist MP3 Upload Form Route | needs_manual_review |
| KCSM Jazz 91 CD Broadcast Consideration Music Director Route | needs_manual_review |
| KGNU Music Department Contact Form and DJ Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized workflows, but all require manual review because they involve radio-edit/WAV package requirements, snail-mail or physical CD review paths, local-artist eligibility checks, MP3 upload/contact form fields, CAPTCHA/reCAPTCHA boundaries, music-department routing decisions, pitch-package quality checks and editorial/station-fit review.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no streaming or download links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no CAPTCHA/reCAPTCHA/challenge was handled, no JavaScript/session controls were handled beyond public page discovery, no protected or obfuscated contacts were decoded, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run121PlatformSeeds.ts
- data/run121-platform-database.json
- data/run121-review-queue.csv
- data/run121-analytics-dashboard.json
- reports/2026-07-04-run-121.md
- reports/daily_report.md
- src/discovery/run120PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 121 seeds are loaded through the existing Run 120 aggregation, which is already loaded through the Run 119, Run 118, Run 117 and Run 113 aggregations, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
