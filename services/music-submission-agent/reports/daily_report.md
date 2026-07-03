# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 100

Run 100 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 560 |
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
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 3 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| WUOG 90.5FM Music Directors Physical Album Submission Route | needs_manual_review |
| WRAS Album 88 Current Rotation Music Department Submission Route | needs_manual_review |
| Amazing Radio Artist Upload and New Music Airplay Route | needs_manual_review |
| TIDAL Upload Direct Artist Upload Route | needs_manual_review |
| SoundOn TikTok Music Distribution Artist Upload Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized music submission, upload, direct-artist, distribution, Music Department, physical-mail, public-email and airplay workflows, but all require manual review because they include physical package preparation, public business-email routing, contact-form handling, JavaScript app boundaries, account/login requirements, release-age constraints, rights/copyright review, AI-origin and royalty implications, distribution-scope decisions, genre/show targeting and track metadata. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no routes were activated, no forms were submitted, no messages were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no distribution route was activated, no profile/store/release settings were changed, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run100PlatformSeeds.ts
- data/run100-platform-database.json
- data/run100-review-queue.csv
- data/run100-analytics-dashboard.json
- reports/2026-07-03-run-100.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 100 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
