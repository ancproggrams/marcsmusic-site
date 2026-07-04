# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 117

Run 117 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 645 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 4 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 1 |
| Login/member/account or session-boundary routes observed | 0 |
| CAPTCHA/challenge routes observed | 0 |
| JavaScript/app-session boundary routes observed | 1 |
| Validation-field routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Redacted/obfuscated contact routes observed | 1 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KBOO-FM Genre-Routed Physical Music Submission Route | needs_manual_review |
| Radio Boise JavaScript-Loaded Submit Your Music Route | needs_manual_review |
| CJSW Digital Album Submission and Campus Radio Mailout Route | needs_manual_review |
| CKUW Music Director Digital Link and Physical Media Submission Route | needs_manual_review |
| WMSE Music Department Physical Digital Download and FCC-Clean Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized global workflows, but all require manual review because they involve physical package preparation, external or JavaScript-loaded forms, broadcast-clean review, recent-album eligibility, link handling, public or obfuscated contact routing, station-fit review, optional paid mailout handling or manual workflow choices.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no links were delivered, no physical mail was sent, no payments or cash mailout packages were initiated, no CAPTCHA or session controls were interacted with, no protected or obfuscated contacts were decoded, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run117PlatformSeeds.ts
- data/run117-platform-database.json
- data/run117-review-queue.csv
- data/run117-analytics-dashboard.json
- reports/2026-07-04-run-117.md
- reports/daily_report.md
- src/discovery/run113PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 117 seeds are loaded through the existing Run 113 aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
