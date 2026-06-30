# Music Submission Agent — Daily Report

Date: 2026-06-30

## Latest run: Run 24

Run 24 added 7 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 7 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 179 |
| New opportunities in latest run | 7 |
| New manual-review queue rows | 7 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 7 |
| Paid/manual-only routes in latest run | 0 |
| Public business/submission contacts observed in latest run | 6 |
| Protected/redacted mailto links observed | 2 |
| Public/external forms observed | 3 |
| CAPTCHA / anti-bot cases observed | 2 |
| Login cases observed | 0 |
| Payment cases observed | 0 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KUTX On-Air Rotation and Specialty Show Music Submission Route | needs_manual_review |
| KVRX 91.7 FM Austin Music Submission Route | needs_manual_review |
| KZSC Santa Cruz Music Director Submission Route | needs_manual_review |
| WERS Wicked Local Wednesday Music Submission Form Route | needs_manual_review |
| Triple R 102.7FM Melbourne Submit Music Route | needs_manual_review |
| CKUA Radio Network Getting Airplay Digital Submission Route | needs_manual_review |
| CJSW 90.9 FM Calgary Digital Music Submission Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve public music-director email outreach, AI/originality policy checks, protected/redacted mailto links, anti-spam validation fields, reCAPTCHA-protected forms, MP3/file uploads, external Jotform upload, local eligibility restrictions, release-format requirements, clean/radio-edit requirements and human program targeting.

## Safety summary

No accounts were created, no emails were sent, no protected forms were submitted, no files were uploaded, no payments were attempted, no terms were accepted, no anti-bot protections were bypassed, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run24PlatformSeeds.ts`
- `data/run24-platform-database.json`
- `data/run24-review-queue.csv`
- `data/run24-analytics-dashboard.json`
- `reports/2026-06-30-run-24.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
