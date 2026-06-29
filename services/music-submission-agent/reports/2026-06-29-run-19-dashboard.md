# Music Submission Agent — Run 19 Analytics Dashboard

Date: 2026-06-29

## KPI summary

| Metric | Value |
|---|---:|
| Estimated runtime seed pipeline after run | 144 |
| New opportunities discovered/enriched | 8 |
| New queue rows | 8 |
| Auto-submit candidates | 0 |
| Needs manual review | 8 |
| Public business emails stored | 0 |
| SMTP probes | 0 |
| MX probes | 0 |
| Guessed/generated contacts | 0 |
| Accounts created | 0 |
| Forms submitted | 0 |
| Uploads performed | 0 |
| Payments attempted | 0 |

## Queue status distribution

| Status | Count |
|---|---:|
| needs_manual_review | 8 |
| queued_for_auto_submit | 0 |

## Route-type distribution

| Route type | Count |
|---|---:|
| Curated label/demo/contact route | 7 |
| Radio/TV distribution and airplay-testing workflow | 1 |

## Manual-review trigger summary

All run 19 records remain `needs_manual_review` because at least one of the following applies:

- current demo/contact policy was not safely form-mapped
- release status, rights, exclusivity and label-fit review is required
- unreleased track or EPK material may be involved
- creator-safe licensing terms may apply
- registration/login or rightsholder upload workflow may be required
- territory, radio/TV targeting or music-video delivery choices may be required
- no platform allowed unattended public auto-submit without human review

## New opportunities

| Platform | Route type | Queue status | Primary manual-review trigger |
|---|---|---:|---|
| Liquicity Records Liquid Drum and Bass Demo Route | label demo | needs_manual_review | Demo fields/widget and rights metadata require confirmation. |
| Armada Music Demo Drop Electronic Label Route | label demo | needs_manual_review | Demo-drop/current form details, label fit and rights review. |
| Monstercat Electronic Label Contact and A&R Route | label contact/A&R | needs_manual_review | No safe public self-serve demo form confirmed. |
| Future House Music Label and Network Demo Route | label/network demo | needs_manual_review | Current demo policy and unreleased-music handling. |
| Hospital Records Drum and Bass Label Route | curated label route | needs_manual_review | DnB label fit and current demo policy review. |
| NoCopyrightSounds NCS Electronic Label and Creator-Safe Music Route | label/licensing route | needs_manual_review | Creator-safe licensing and exclusivity terms review. |
| Anjunabeats and Anjuna Electronic Label Route | curated label route | needs_manual_review | Label ecosystem fit, rights and release status review. |
| TopHit Radio and TV Music Distribution Platform | radio/TV distribution | needs_manual_review | Rightsholder registration, upload, metadata and targeting review. |

## Safety counters

| Safety item | Count / state |
|---|---:|
| CAPTCHA bypass / solving | 0 |
| Anti-bot bypass | 0 |
| Login or authentication bypass | 0 |
| Account creation | 0 |
| Protected form submission | 0 |
| Track/music-video upload | 0 |
| Terms acceptance | 0 |
| Payment or campaign purchase | 0 |
| Business-email guessing | 0 |
| SMTP probing | 0 |
| MX probing | 0 |

## Runtime/export note

The Railway/local worker was not started during this code update. The run 19 database and queue artifacts are committed as deterministic repo outputs. When the worker next runs, `run19SeedPlatforms` will be idempotently upserted through `platformCanonicalKey`, verification jobs will be queued, and runtime exports can regenerate from SQLite.
