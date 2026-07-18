# Daily Report

Date: 2026-07-18

Latest run: Run 472

New items added in latest run: 2

Existing items reverified or materially enriched: 0

Duplicate opportunity counts retired: 0

Pipeline estimate: 1764

Items:

- Run 472 added: SoundChat Radio — a free global-facing first-party form for Caribbean music using a track link and broadcast-permission confirmation.
- Run 472 added: All'It Radio — a one-track Google Form route for Reggae, Hip Hop, R&B and Urban music requiring Gmail authentication, audio and cover-art uploads, voting and a social follow.

Two new queue rows were created with `needs_manual_review`. No auto-submit candidate was created.

Latest route note: SoundChat requests high-quality MP3 or WAV audio, a clean edit where applicable, complete metadata, a short bio, social links and a SoundCloud, Spotify, YouTube or direct-download link. All'It requests one downloadable 44.1 kHz, 16-bit stereo MP3 or WAV plus cover art through a Gmail-authenticated Google Form; selected tracks must then reach 100 valid-email votes and satisfy a station social-follow condition.

Contact-verification note: `info@soundchatradio.com` and `info@allitradio.com` are first-party published, syntactically valid and domain-aligned business addresses. Neither is an authorized music-submission mailbox: SoundChat uses its dedicated form, and All'It explicitly rejects email submissions. Adjacent `irishandchin@gmail.com` and `hitus@allitradio.com` routes were excluded. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.

Activity and fit note: SoundChat publishes 24/7 streaming, an active weekly schedule, current rotation and featured artists, and a story dated March 16, 2026. All'It publishes a 24-hour station description and current Friday and Saturday programmes with named hosts. SoundChat is a strong fit for MarcsMusic reggae, dancehall, soca and Caribbean-fusion tracks. All'It is a plausible fit for reggae and urban material, but international eligibility is not explicit.

Manual-review note: SoundChat's form includes a rights-ownership confirmation and broadcast permission. All'It requires Gmail authentication, direct audio and artwork uploads, broadcast permission, audience voting and a social-follow condition; its external Google Form returned HTTP 401 Unauthorized and was not bypassed. Humans must review track and clean-edit fit, metadata, external links, rights, AI eligibility, complete consent text, privacy, hidden controls and every final action.

Deduplication note: repository code search contained no existing canonical SoundChat Radio or All'It Radio record, domain, submission route or public business address before creation. Each platform is consolidated into one opportunity. Canonical SQLite domain and URL deduplication remains required before external use.

Runtime limitation: repository and public-web connectors updated the artifacts. A mounted repository worktree and dedicated `agent-browser` runner were unavailable. No browser screenshot, successful build, test, lint, SQLite-worker, `git diff` or `git status` result is claimed.

Safety: No form field was filled, no account was accessed, no track link, audio or artwork was uploaded, no email was sent, no vote was cast, no social follow was made, no CAPTCHA was solved and no payment or submission action was completed. No anti-bot, authentication, payment or platform restriction was bypassed.

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

### Run 471

Added WRIU's Electronic, World and Reggae department mailboxes, The Edge 105's clean global-reggae form, Indie Global 365's free direct-upload form and Smooth Jazz Club's international specialist email route. Eligibility, rights, content and genre fit, terms, files, external links, hidden controls and final actions require manual review. Pipeline estimate: 1,762.

### Run 472

Added SoundChat Radio's free global Caribbean track-link form and All'It Radio's Gmail-authenticated one-track Google Form. Rights and broadcast consent, clean edits, direct media uploads, audience voting, social-follow conditions, AI/international eligibility, hidden controls and final actions require manual review. Pipeline estimate: 1,764.

Earlier run details remain available in the dated per-run reports under `services/music-submission-agent/reports/`.
