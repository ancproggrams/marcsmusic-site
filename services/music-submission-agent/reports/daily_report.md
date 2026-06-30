# Music Submission Agent — Daily Report

Date: 2026-06-30

## Latest run: Run 23

Run 23 added 6 newly researched public-authorized global music submission opportunities for MarcsMusic and classified all 6 as `needs_manual_review`.

## Current estimated pipeline

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline | 172 |
| New opportunities in latest run | 6 |
| New manual-review queue rows | 6 |
| New auto-submit candidates | 0 |
| Free-first routes in latest run | 5 |
| Paid/manual-only routes in latest run | 1 |
| Public business/submission contacts observed in latest run | 4 |
| Protected mailto links observed | 2 |
| SMTP probes during repo update | 0 |
| MX probes during repo update | 0 |
| Guessed/generated contacts | 0 |

## Latest opportunities

| Platform | Status |
|---|---:|
| KEXP Airplay Consideration Digital Submission Route | needs_manual_review |
| KALX Berkeley Airplay Physical Music Submission Route | needs_manual_review |
| WXPN Airplay and Local Show Music Submission Route | needs_manual_review |
| KJHK 90.7 FM Electronic Music Submission Route | needs_manual_review |
| Spinnin Records Talent Pool Demo Submission Route | needs_manual_review |
| International Songwriting Competition 2026 Online Entry Route | needs_manual_review |

## Manual-review reasons

The latest routes require human review because they involve music-director outreach quality control, postal-only submission rules, Cloudflare-protected mailto links, external/local forms, login-gated demo upload, paid contest entry, rights/originality declarations, AI-use disclosure, category eligibility or platform terms review.

## Safety summary

No accounts were created, no protected forms were submitted, no payments were attempted, no music or video assets were uploaded, no terms were accepted, no anti-bot protections were bypassed, no contacts were guessed, and no SMTP or MX probing was performed during this repo update.

## Artifacts produced

- `src/discovery/run23PlatformSeeds.ts`
- `data/run23-platform-database.json`
- `data/run23-review-queue.csv`
- `data/run23-analytics-dashboard.json`
- `reports/2026-06-30-run-23.md`
- `reports/daily_report.md`

## Runtime note

The committed run artifacts are ready for the next worker execution, which will idempotently upsert platforms, queue verification jobs, apply pricing/free-first priority classification and regenerate SQLite-backed exports.
