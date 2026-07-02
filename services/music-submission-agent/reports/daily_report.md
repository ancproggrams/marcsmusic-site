# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 67

Run 67 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 395 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 3 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 1 |
| Official public physical-mail routes observed | 0 |
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 2 |
| Login/member/account routes observed | 1 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| A&R Factory Submit Your Music | needs_manual_review |
| WXPN Submit Music for Airplay | needs_manual_review |
| SomaFM Submit Music and Channel Music Director Contacts | needs_manual_review |
| Radio Boise Submit Your Music | needs_manual_review |
| RepostExchange SoundCloud Creator Promotion Campaigns | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public editorial, radio airplay, internet radio, community radio and SoundCloud creator-promotion workflows, but all require manual review because they involve public form completion, optional paid package/payment choices, channel-specific email targeting and anti-bulk rules, JavaScript-rendered form content, SoundCloud OAuth/login, credit/campaign choices, metadata, rights/originality assertions and publication/programming/platform-fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run67PlatformSeeds.ts
- data/run67-platform-database.json
- data/run67-review-queue.csv
- data/run67-analytics-dashboard.json
- reports/2026-07-02-run-67.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
