# Music Submission Agent - Daily Report

Date: 2026-07-02

## Latest run: Run 63

Run 63 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 375 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Official public route pages observed | 5 |
| Official public music/business email routes observed | 3 |
| Official public physical-mail routes observed | 5 |
| Public application/upload/contact forms observed | 0 |
| Payment/payment-option side routes observed | 0 |
| Login/member/account routes observed | 0 |
| CAPTCHA/bot-protection routes observed | 0 |
| External/manual workflow routes observed | 5 |
| Protected/redacted contact routes observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KSPC 88.7FM Claremont Music Submissions | needs_manual_review |
| KXLU 88.9FM Los Angeles Submissions | needs_manual_review |
| KDVS 90.3FM Davis Music Department Submissions | needs_manual_review |
| WREK 91.1FM Atlanta How To Submit Music | needs_manual_review |
| WMBR 88.1FM MIT Your Music | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public college/community/freeform radio submission routes, but all require manual review because they involve physical mailing or email-based submission, album/EP eligibility checks, downloadable-file preparation, metadata and one-sheet preparation, FCC-clean or explicit-content labeling, no-singles/no-demos/no-AI restrictions on some routes, protected/masked contact handling, rights/originality assertions, follow-up timing and station/show-fit decisions. No route in this batch exposed a safe complete public auto-submit flow.

## Safety summary

No accounts were created, no route was activated, no forms were submitted, no emails were sent, no files were transferred, no physical mail was sent, no payments were attempted, no CAPTCHA/reCAPTCHA or validation controls were bypassed, no protected or masked contacts were decoded, no contacts were guessed and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- src/discovery/run63PlatformSeeds.ts
- data/run63-platform-database.json
- data/run63-review-queue.csv
- data/run63-analytics-dashboard.json
- reports/2026-07-02-run-63.md
- reports/daily_report.md

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
