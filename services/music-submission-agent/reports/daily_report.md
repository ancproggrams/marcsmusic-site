# Daily Report

Date: 2026-07-18

Latest run: Run 470

New items added in latest run: 2

Existing items reverified or materially enriched: 0

Duplicate opportunity counts retired: 0

Pipeline estimate: 1758

Items:

- Run 470 added: KWDC 93.5 FM — a first-party clean-MP3 email route requiring a signed music-consent form.
- Run 470 added: Qfm 94.3 Tenerife — a free international first-party contact-form route using a WeTransfer or Dropbox download link.

Two new queue rows were created with `needs_manual_review`. No auto-submit candidate was created.

Latest route note: KWDC requires clean content, a signed or digitally completed consent form, MP3 files and a stereo master at -3 dB. Qfm requires genre-compatible 192 or 320 kbps constant-bitrate MP3 files, complete metadata, trimmed silence, artist information, a ZIP package and a WeTransfer or Dropbox link; YouTube, Facebook, Google Drive and SoundCloud links are rejected.

Contact-verification note: `kwdc@deltacollege.edu` is first-party published, syntactically valid, aligned with the Delta College domain and explicitly designated for music submissions. Qfm publishes no submission mailbox and directs artists through its contact form. No protected address was decoded. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.

Activity and fit note: KWDC's first-party Summer 2026 schedule states that it runs 24 hours every day and plays Latin, Top 40, Rock and Dance; its Underground Hour highlights unsigned music daily. Qfm's first-party pages carry a 2026 copyright notice, advertise current FM, DAB+ and streaming, and list Sunset Sessions, World Grooves, Chillout Zone and a monthly unsigned-artist show. Qfm explicitly accepts regional, national and international artists in Jazz, Soul, Funk, Blues, World Fusion and related styles.

Manual-review note: KWDC's consent PDF and Google consent form were not passively retrievable, and international and AI eligibility remain unresolved. Qfm requires an external file-hosting upload and publishes no AI policy. A human must review legal terms, rights, metadata, files, privacy and link permissions, hidden controls, all consent choices and every final upload, send or submit action.

Deduplication note: the accessible open pull-request patch and repository search contained no existing KWDC, kwdc.fm, kwdc@deltacollege.edu, Qfm 94.3, Qfm Tenerife or qmusica.com record. KWDC is consolidated into one email-plus-consent opportunity and Qfm into one contact-form opportunity. Canonical SQLite domain and URL deduplication remains required before external use.

Runtime limitation: repository and public-web connectors updated the artifacts. A mounted repository worktree and the dedicated `agent-browser` runner were unavailable. The linked KWDC consent surfaces were not retrievable. No browser screenshot, successful build, test, lint, SQLite-worker, `git diff` or `git status` result is claimed.

Safety: No form field was filled, no consent was signed, no file or ZIP was uploaded, no email was sent, no account or login was used, no CAPTCHA was solved and no payment or submission action was completed. No anti-bot, authentication, payment or platform restriction was bypassed.

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

### Run 467

Added Discover YOU RADIO as a free first-party rotation-evaluation form. Clean-track suitability, iTunes-link accuracy, rights, AI/international eligibility, mailing-list consent, hidden live controls and optional paid/sync boundaries require manual review. Pipeline estimate: 1,754.

### Run 468

Added Variety Vibes Radio & TV as a worldwide-facing rolling 2026 direct-upload form. External agreement acceptance, broad perpetual promotional terms, direct media uploads, rights, AI eligibility, live controls and optional paid-service boundaries require manual review. Pipeline estimate: 1,755.

### Run 469

Added Airhug Radio as a worldwide-facing four-step direct-upload form. PRO and SoundExchange prerequisites, legal and royalty data, media consent, broadcast authorization, digital signature, linked terms and a strict AI prohibition require manual review. Pipeline estimate: 1,756.

### Run 470

Added KWDC 93.5 FM as a clean-MP3 email route with mandatory consent and Qfm 94.3 Tenerife as a free international contact-form route using an external download link. Consent terms, rights, uploads, hidden controls and AI eligibility require manual review. Pipeline estimate: 1,758.

Earlier run details remain available in the dated per-run reports under `services/music-submission-agent/reports/`.
