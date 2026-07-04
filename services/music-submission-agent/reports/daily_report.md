# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 110

Run 110 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 610 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 4 |
| Freemium/manual routes in latest run | 1 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 1 |
| Public application/upload/contact forms observed | 1 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account or session-boundary routes observed | 1 |
| CAPTCHA/session-boundary routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KEXP Rotation Consideration Digital Music Director Submission Route | needs_manual_review |
| WFMU Music Director Physical Review Package Submission Route | needs_manual_review |
| NTS Radio Show Proposal and Supporter Mix Submission Route | needs_manual_review |
| WXPN Airplay and Local Show Digital EPK Submission Route | needs_manual_review |
| Atwood Magazine Editorial Pitching Music Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized radio and music-editorial workflows, but all require manual review because they involve digital pitch packages, streaming/WAV download links, physical package preparation, show-proposal form fields, subscriber/account/payment side-route boundaries, release and rights metadata, FCC-clean notes, curation/station-fit review and an obfuscated public-contact boundary. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no CAPTCHA, validation or session controls were interacted with, no protected or obfuscated contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run110PlatformSeeds.ts
- data/run110-platform-database.json
- data/run110-review-queue.csv
- data/run110-analytics-dashboard.json
- reports/2026-07-04-run-110.md
- reports/daily_report.md
- src/discovery/run109PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 110 seeds are loaded through the existing run109 seed import, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.