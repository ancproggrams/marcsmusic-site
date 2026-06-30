# Music Submission Agent — Daily Report

Date: 2026-06-30

## Latest run: Run 25

Run 25 added 5 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 5 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 184 |
| New opportunities in latest run | 5 |
| New manual-review queue rows | 5 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 2 |
| Freemium/manual routes in latest run | 2 |
| Unknown/manual routes in latest run | 1 |
| Paid/manual-only routes in latest run | 0 |
| Public business/submission contacts observed in latest run | 3 |
| Protected / JavaScript-guarded contacts observed | 1 |
| Public/external forms observed | 0 |
| Third-party freemium routes observed | 2 |
| CAPTCHA / anti-bot cases observed | 0 |
| Login cases observed | 2 |
| Payment cases observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| EARMILK SubmitHub and Pillargram Music Submission Route | needs_manual_review |
| Obscure Sound SubmitHub and MusoSoup Indie/Electronic Submission Route | needs_manual_review |
| Variance Magazine Editorial Pitch and Premiere Submission Route | needs_manual_review |
| Radio Milwaukee Music Submission Route | needs_manual_review |
| KCRW Airplay Consideration and Contact Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve third-party freemium submission platforms, login/credit/feedback-term review, JavaScript/spambot-protected contact links, radio-clean audio package checks, WAV-preferred file/link preparation, editorial/premiere fit checks, manual contact resolution and high-selectivity public-radio program targeting.

## Safety summary

No accounts were created, no emails were sent, no protected forms were submitted, no files were uploaded, no payments were attempted, no terms were accepted, no anti-bot protections were bypassed, no protected emails were decoded, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run25PlatformSeeds.ts`
- `data/run25-platform-database.json`
- `data/run25-review-queue.csv`
- `data/run25-analytics-dashboard.json`
- `reports/2026-06-30-run-25.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
