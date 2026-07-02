# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 72

Run 72 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 420 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 4 |
| Official public physical-mail routes observed | 2 |
| Public application/upload/contact forms observed | 2 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 1 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| CIUT 89.5 FM Toronto Music Submissions | needs_manual_review |
| KGNU Community Radio Music Department Contact Form | needs_manual_review |
| WPKN 89.5 Community Radio Music Submission | needs_manual_review |
| WFUV Public Media Contact Form and Music Discovery Route | needs_manual_review |
| WRFL 88.1 FM Lexington Contact and Rotation Review Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public/community/campus radio and public-media music discovery routes, but all require manual review because they involve targeted email preparation, public contact forms with reCaptcha or JavaScript/anti-spam handling, protected-contact handling without decoding, physical-vs-digital package selection, clean/radio-edit assertions, metadata, rights/originality assertions, local/station fit and programming/editorial routing decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run72PlatformSeeds.ts
- data/run72-platform-database.json
- data/run72-review-queue.csv
- data/run72-analytics-dashboard.json
- reports/2026-07-02-run-72.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
