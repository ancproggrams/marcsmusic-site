# Music Submission Agent - Daily Report

Date: 2026-06-30

## Latest run: Run 26

Run 26 added 7 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 7 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 191 |
| New opportunities in latest run | 7 |
| New manual-review queue rows | 7 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 7 |
| Freemium/manual routes in latest run | 0 |
| Unknown/manual routes in latest run | 0 |
| Paid/manual-only routes in latest run | 0 |
| Public business/submission contacts observed in latest run | 4 |
| Protected / JavaScript / cookie-guarded contacts or routes observed | 3 |
| Public/external forms observed | 4 |
| Third-party freemium routes observed | 0 |
| CAPTCHA / anti-spam / session-guarded cases observed | 4 |
| Login cases observed | 0 |
| Payment cases observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| FBi Radio Music Submission Route | needs_manual_review |
| PBS 106.7FM Melbourne Digital Music Submission Form | needs_manual_review |
| 2SER 107.3FM Music Airplay Consideration Form | needs_manual_review |
| RTRFM 92.1 Perth Music Submission Form and Presenter Servicing Route | needs_manual_review |
| 4ZZZ Brisbane Music Submissions Route | needs_manual_review |
| KBOO Community Radio Portland Physical Music Submission Route | needs_manual_review |
| KZSU Stanford Music Director and Send Music Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve tailored radio pitch preparation, CAPTCHA or anti-spam controls, dynamic form loading, protected contact links, form validation/honeypot fields, cookie/session-guarded music systems, physical-mail submission rules, ownership implications for mailed media, and unresolved music-specific form details.

## Safety summary

No accounts were created, no emails were sent, no protected forms were submitted, no files were uploaded, no payments were attempted, no terms were accepted, no platform controls were circumvented, no protected emails were decoded, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run26PlatformSeeds.ts`
- `data/run26-platform-database.json`
- `data/run26-review-queue.csv`
- `data/run26-analytics-dashboard.json`
- `reports/2026-06-30-run-26.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
