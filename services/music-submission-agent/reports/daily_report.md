# Music Submission Agent - Daily Report

Date: 2026-07-04

## Latest run: Run 119

Run 119 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as needs_manual_review.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 655 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public route/source pages observed | 5 |
| Official public music/business email or contact routes observed | 5 |
| Official public physical-mail/package side routes observed | 0 |
| Public application/upload/contact forms observed | 4 |
| Payment/payment-option side routes observed | 2 |
| Login/member/account or session-boundary routes observed | 3 |
| CAPTCHA/challenge routes observed | 0 |
| JavaScript/app-session boundary routes observed | 2 |
| Validation-field routes observed | 2 |
| External/manual workflow routes observed | 5 |
| Redacted/obfuscated contact routes observed | 4 |
| SMTP checks during repo update | 0 |
| MX checks during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| Fresh On The Net Listening Post Weekly Track Submission Route | needs_manual_review |
| Obscure Sound SubmitHub MusoSoup Email and PR Submission Route | needs_manual_review |
| The Other Side Reviews MusoSoup and Editorial Contact Submission Route | needs_manual_review |
| Under the Radar Magazine JavaScript-Protected Submissions Contact Route | needs_manual_review |
| The Line of Best Fit New Unsigned Artist Google Form Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes are legitimate public-authorized global workflows, but all require manual review because they involve weekly submission-window timing, one-track limits, AI-generated-track exclusions, SubmitHub/MusoSoup external workflows, paid PR/payment side routes, Google Form required fields, JavaScript/session boundaries, redacted or obfuscated contact handling, pitch-package quality checks and editorial-fit review.

## Safety summary

No accounts were created, no login was used, no forms were submitted, no messages or emails were sent, no files were uploaded or transferred, no streaming or download links were delivered, no physical mail was sent, no payments or subscriptions were initiated, no CAPTCHA/challenge was handled, no JavaScript/session controls were handled beyond public page discovery, no redacted or obfuscated contacts were decoded, no contacts were guessed, and no SMTP or MX checks were performed during this repo update.

## Artifacts produced

- src/discovery/run119PlatformSeeds.ts
- data/run119-platform-database.json
- data/run119-review-queue.csv
- data/run119-analytics-dashboard.json
- reports/2026-07-04-run-119.md
- reports/daily_report.md
- src/discovery/run118PlatformSeeds.ts aggregation update

## Runtime note

The committed run artifacts are ready for the next worker execution. Run 119 seeds are loaded through the existing Run 118 aggregation, which is already loaded through the Run 117 and Run 113 aggregations, then idempotently upserted, queued for verification, classified for pricing/free-first priority and included in regenerated exports.
