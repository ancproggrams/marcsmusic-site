# Daily Report

Date: 2026-07-17

Latest run: Run 464

New items added in latest run: 1

Existing items reverified or materially enriched: 0

Duplicate opportunity counts retired: 0

Pipeline estimate: 1751

Items:

- Run 464 added: OurTownRadio — a first-party independent-music email route accepting metadata-tagged MP3 delivery, free download links, Spotify/YouTube links and an optional physical-media alternative.

One new queue row was created with `needs_manual_review`. No auto-submit candidate was created.

Latest route note: the official submission page accepts one original song or a full album across almost all genres, prefers MP3 files with title/artist/album metadata, asks for artist and social links, and publishes `music@ourtownradio.com` as the music-submission mailbox. Cover songs are prohibited unless the submitter holds the required rights.

Contact-verification note: `music@ourtownradio.com` is first-party published, syntactically valid, domain aligned and context aligned. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.

Activity and fit note: the first-party page displayed a July 11, 2026 weekly Top 10, current tracks and upcoming shows. The published genres include Indie, Pop, Acoustic, Rock, R&B, Hip hop, Hard Rock, Screamo, Country, Folk, Punk and unusual or experimental music. Selected MarcsMusic crossover tracks may fit after human track-level review.

Manual-review note: the submission and Terms pages grant non-exclusive airplay, hosting and promotional-use rights. A human must review scope, territory, duration and revocability; confirm ownership, cover-song and sample rights; clarify international and AI-music eligibility; and approve the final email or file-transfer action.

Deduplication note: repository code searches returned no existing `OurTownRadio`, `ourtownradio.com` or `music@ourtownradio.com` record. Email, download/streaming-link and physical-delivery guidance were consolidated as one canonical opportunity. Canonical SQLite domain/email deduplication remains required before external use.

Runtime limitation: the repository connector updated the artifacts, but the dedicated `agent-browser` CLI and repository shell were unavailable. The JSON and CSV payloads were parsed before writing. No browser screenshot, successful build, test, lint, SQLite-worker, `git diff` or `git status` result is claimed.

Safety: No email was sent, no form field was filled, no audio or image was uploaded, no account or login was used, no CAPTCHA was solved and no payment or submission action was completed. No anti-bot, authentication, payment or platform restriction was bypassed.

## Recent run history

### Run 450

Added Wepa.Fm as a first-party independent-music email route requiring a signed royalty-free licensing agreement. It remains `needs_manual_review`.

### Runs 451–461

Completed passive evidence coverage for the existing 645-route browser inventory and retried the final four explicit error routes. No external action was performed.

### Run 462

Added JAM Audio Live as a worldwide free-first route linking to an external Google Form. It remains `needs_manual_review` because the external form boundaries were not inspectable.

### Run 463

Added IndieMusicFans as a worldwide free-first embedded-form route. Meta-tagged MP3 delivery, AI disclosure and streaming permission are published; form fields and legal boundaries remain manual-review items. Pipeline estimate: 1,750.

### Run 464

Added OurTownRadio as a free-first public email route. Metadata, original-music, download-link and rights requirements are published; international and AI eligibility and the promotional-use grant remain manual-review items. Pipeline estimate: 1,751.

Earlier run details remain available in the dated per-run reports under `services/music-submission-agent/reports/`.
