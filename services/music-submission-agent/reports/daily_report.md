# Daily Report

Date: 2026-07-18

Latest run: Run 466

New items added in latest run: 1

Existing items reverified or materially enriched: 0

Duplicate opportunity counts retired: 0

Pipeline estimate: 1753

Items:

- Run 466 added: MOCRadio Network — a first-party public email route requesting a radio/clean MP3, `Artist - Song Title` metadata and Twitter information for airplay review.

One new queue row was created with `needs_manual_review`. No auto-submit candidate was created.

Latest route note: the official submission page directs artists to `mp3@mocradio.com`, requests a clean MP3 with correct filename/tags and identifies a weekly Music Discovery Radio programme for unsigned and independent artists. Optional guaranteed-exposure promotional packages are separate from the standard editorial-review route.

Contact-verification note: `mp3@mocradio.com` is first-party published, syntactically valid, domain aligned, context aligned and explicitly designated for music submissions. `lc@mocradio.com` and `advertise@mocradio.com` were excluded as program-director and advertising contacts. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.

Activity and fit note: the first-party home and program/music-director pages publish current recurring schedules. Supporting podcast evidence lists a MOCRadio episode aired on June 20, 2026. Published formats include R&B, Hip-Hop, House, EDM, Indie Music and Reggae, giving selected clean MarcsMusic electronic, house, reggae and crossover tracks a plausible fit after human review.

Manual-review note: a human must choose a format-compatible clean track, confirm MP3 metadata and all rights, clarify AI-assisted-music and international eligibility, approve the final email and attachment, and keep optional paid promotional services outside the free editorial-review workflow.

Deduplication note: repository code search and the open pull-request patch contained no existing `MOCRadio`, `mocradio.com` or `mp3@mocradio.com` record. The submission mailbox, indie programme, program-director contact and optional paid services were consolidated as one canonical opportunity. Canonical SQLite domain/email deduplication remains required before external use.

Runtime limitation: the repository and web connectors updated and verified the artifacts. Attempts to invoke `agent-browser` through npm did not produce a usable runner, and no mounted repository worktree was available. No browser screenshot, successful build, test, lint, SQLite-worker, `git diff` or `git status` result is claimed.

Safety: No email was sent, no MP3 was attached, no account or login was used, no CAPTCHA was solved and no payment or submission action was completed. No anti-bot, authentication, payment or platform restriction was bypassed.

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

### Run 465

Added KDBR Dain Bramage Radio as a free worldwide-facing upload/private-link route. reCAPTCHA, direct uploads and a later permission form require manual review. Pipeline estimate: 1,752.

### Run 466

Added MOCRadio Network as a free-first public MP3 email route. Clean-version, metadata, rights, AI/international eligibility and optional paid-promotion boundaries require manual review. Pipeline estimate: 1,753.

Earlier run details remain available in the dated per-run reports under `services/music-submission-agent/reports/`.
