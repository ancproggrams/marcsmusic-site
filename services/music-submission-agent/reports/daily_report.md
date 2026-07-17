# Daily Report

Date: 2026-07-17

Latest run: Run 463

New items added in latest run: 1

Existing items reverified or materially enriched: 0

Duplicate opportunity counts retired: 0

Pipeline estimate: 1750

Items:

- Run 463 added: IndieMusicFans — a first-party worldwide free music-submission page using an embedded online form for possible IndieMusicFans/OTAT247 radio streaming.

One new queue row was created with `needs_manual_review`. No auto-submit candidate was created.

Latest route note: the official page welcomes indie rock bands and artists worldwide, asks for meta-tagged MP3 tracks through its online form, accepts Rock, Metal, Ska, Punk and Synth/EDM/Pop, and requires disclosure of AI elements. Artists retain their rights while granting the station permission to stream submitted music.

Contact-verification note: `otat247@gmail.com` is first-party published for questions not answered in the FAQ. It is syntactically valid and context aligned, but uses Gmail rather than the site domain and is excluded as the canonical music-submission route because the page directs artists to the online form. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.

Activity and fit note: the current station page publishes recurring weekly and monthly programming and describes worldwide curation across Rock, Metal, Punk, Ska, Synthwave, EDM and Acoustic music. Selected MarcsMusic electronic, pop or crossover tracks may fit after track-level human review.

Manual-review note: the embedded form was not passively field-inspected. A human must verify required fields, MP3 upload limits, CAPTCHA/login controls, privacy and streaming-permission scope, AI eligibility, track suitability and rights status before manually completing it.

Deduplication note: the accessible repository code-search surface returned no `indiemusicfans.com` match before creation. The first-party page and embedded form were consolidated as one opportunity; the FAQ mailbox remains a fallback contact rather than a separate submission route. Canonical SQLite domain/email deduplication remains required before external use.

Runtime limitation: the repository connector updated the artifacts, but the dedicated `agent-browser` CLI and repository shell were unavailable. The JSON and CSV artifacts were parsed locally before writing. No browser screenshot, successful build, test, lint, SQLite-worker, `git diff` or `git status` result is claimed.

Safety: No form field was filled, no email was sent, no audio or image was uploaded, no account or login was used, no CAPTCHA was solved and no payment or submission action was completed. No anti-bot, authentication, payment or platform restriction was bypassed.

## Recent run history

### Run 450

Added Wepa.Fm as a first-party independent-music email route requiring a signed royalty-free licensing agreement. It remains `needs_manual_review`.

### Runs 451–461

Completed passive evidence coverage for the existing 645-route browser inventory and retried the final four explicit error routes. No external action was performed.

### Run 462

Added JAM Audio Live as a worldwide free-first route linking to an external Google Form. It remains `needs_manual_review` because the external form boundaries were not inspectable.

### Run 463

Added IndieMusicFans as a worldwide free-first embedded-form route. Meta-tagged MP3 delivery, AI disclosure and streaming permission are published; form fields and legal boundaries remain manual-review items. Pipeline estimate: 1,750.

Earlier run details remain available in the dated per-run reports under `services/music-submission-agent/reports/`.
