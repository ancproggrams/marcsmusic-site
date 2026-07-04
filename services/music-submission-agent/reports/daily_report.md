# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 118

Run 118 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 650 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 3 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account or session-boundary routes observed | 0 |
| CAPTCHA/challenge routes observed | 0 |
| JavaScript/app-session boundary routes observed | 2 |
| Validation-field routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Redacted/obfuscated contact routes observed | 0 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KUTX On-Air Rotation and Specialty Show Music Submission Route | needs_manual_review |
| KXLU FCC-Clean Music Director Demolisten and Specialty Submission Route | needs_manual_review |
| WHUS New Music Committee and Music Director Review Submission Route | needs_manual_review |
| KUSF College Radio Music Department Email and Physical Submission Route | needs_manual_review |
| KZSU Stanford Music Director Mail Email and Cookie-Protected Guidelines Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized global workflows, but all require manual review because they involve outbound business-email preparation, physical package routing, radio-clean/FCC-clean review, streaming and WAV download-link preparation, specialty-show targeting, public-contact selection, JavaScript/cookie/session boundaries or external manual workflow choices.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no streaming or download links were delivered, no physical mail was sent, no payments or sponsorship routes were initiated, no JavaScript/cookie/session controls were handled beyond public page discovery, no protected or obfuscated contacts were decoded, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run118PlatformSeeds.ts
- data/run118-platform-database.json
- data/run118-review-queue.csv
- data/run118-analytics-dashboard.json
- reports/2026-07-04-run-118.md
- reports/daily_report.md
- src/discovery/run117PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 118 seeds are loaded through the existing Run 117 aggregation, which is already loaded through the Run 113 aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.