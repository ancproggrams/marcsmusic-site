# Daily Report

Date: 2026-07-17

Latest run: Run 465

New items added in latest run: 1

Existing items reverified or materially enriched: 0

Duplicate opportunity counts retired: 0

Pipeline estimate: 1752

Items:

- Run 465 added: KDBR Dain Bramage Radio — a first-party worldwide-facing free submission form accepting clean MP3/WAV uploads, artwork attachments or private SoundCloud/YouTube links.

One new queue row was created with `needs_manual_review`. No auto-submit candidate was created.

Latest route note: the official KDBR page requests Band/Artist Name, Email, Genres and a Desired Link, permits track and artwork attachments, advertises a normal 48-hour listening window and says selected artists receive a separate permission form before rotation and a permanent featured-artist profile.

Contact-verification note: `contact@dainbramageentertainment.com` is first-party published, syntactically valid, domain aligned and context aligned as a general business mailbox. It is not designated as a music-submission mailbox and was excluded from the submission route. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.

Activity and fit note: the official KDBR page advertises a live station and current featured artists; the first-party featured-artists page lists artists currently in heavy rotation; and the linked Caster.fm page publishes daily broadcasts from 7 AM to at least 5 PM AKST. The main page's 24/7 wording differs from the Caster schedule and remains a manual-review note. Published genres include hip-hop, rock, electronic, pop, metal, R&B, indie and lo-fi, giving selected MarcsMusic tracks a plausible fit after clean-edit review.

Manual-review note: the embedded form is protected by Google reCAPTCHA, permits direct file uploads and leads to a later permission form. A human must review upload limits and permission terms; confirm clean audio, ownership, samples, contributors and artwork rights; clarify AI-music eligibility; and approve any upload and final submission.

Deduplication note: repository code searches returned no existing `KDBR`, `Dain Bramage`, `dainbramageentertainment.com` or canonical KDBR submission-page record. The upload form, private-link alternative, permission step, featured-artist profile and general mailbox were consolidated as one canonical opportunity. Canonical SQLite domain/email deduplication remains required before external use.

Runtime limitation: the repository connector updated the artifacts, but the dedicated `agent-browser` CLI and repository shell were unavailable. No browser screenshot, successful build, test, lint, SQLite-worker, `git diff` or `git status` result is claimed.

Safety: No form field was filled, no email was sent, no audio or image was uploaded, no permission form was signed, no account or login was used, no CAPTCHA was solved and no payment or submission action was completed. No anti-bot, authentication, payment or platform restriction was bypassed.

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

Earlier run details remain available in the dated per-run reports under `services/music-submission-agent/reports/`.
