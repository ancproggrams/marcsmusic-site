# Music Submission Agent - Daily Report

Date: 2026-07-03

## Latest run: Run 101

Run 101 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 565 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 1 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 1 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KFAI Music Department and Music Library Submission Email Route | needs_manual_review |
| WNCW Programming Department CD and Digital Music Submission Route | needs_manual_review |
| Radio Boise Submit Your Music Public Form Route | needs_manual_review |
| KGNU Community Radio Music Department Contact Form Route | needs_manual_review |
| KBCS Music Director and Music Librarian Public Music Contact Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized music submission, contact, Music Department, programming or airplay workflows, but all require manual review because they include public business-email routing, CD/physical package preparation, digital download-link permission checks, JavaScript/loading form boundaries, reCaptcha v3, protected/redacted email boundaries, incomplete static submission policy details, metadata, clean/radio-edit checks, genre/show targeting and human-approved pitch copy. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no login was used, no routes were activated, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no download links were delivered, no physical mail was sent, no payments were initiated, no CAPTCHA, validation or session controls were interacted with, no protected contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run101PlatformSeeds.ts
- data/run101-platform-database.json
- data/run101-review-queue.csv
- data/run101-analytics-dashboard.json
- reports/2026-07-03-run-101.md
- reports/daily_report.md
- src/discovery/run91PlatformSeeds.ts aggregation

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 101 seeds are loaded through the already-wired Run 91 seed module aggregation, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated SQLite-backed exports.
