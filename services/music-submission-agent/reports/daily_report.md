# Daily Report

Date: 2026-07-14

Latest run: Run 353

New items added: 2

Existing items materially enriched: 0

Pipeline estimate: 1676

Items:

- KEXP Global Digital Music Submission Email Route — new
- WXPN 88.5 Digital EPK Music Submission Route — new

Both queue items are marked needs_manual_review.

Deduplication note: The active pull-request dataset was searched for KEXP, KEXP Seattle, kexp.org, md@kexp.org, the official KEXP submission-guidelines path, WXPN, WXPN 88.5, xpn.org and the official WXPN Contact path. Neither station had an existing canonical music-submission opportunity. KEXP's contact page, guidelines, Music Department mailbox and optional direct-DJ guidance were consolidated into one record, with only the station-level Music Department route queued. WXPN's main Music Director route was kept separate from its locally focused Local Show route.

Manual-review note: KEXP requires streaming and WAV download links without attachments plus artist, release, content, lyric, credit and biography information. WXPN requires an EPK with a digital download link, but its first-party Music Director destination was not exposed in passive plaintext and was not decoded or guessed. A human must choose a rights-cleared release, verify content and catalogue fit, prepare the required package and send each submission manually.

Email-verification note: KEXP publishes md@kexp.org in plaintext on its official Contact and Submission Guidelines pages specifically for rotation consideration; syntax, purpose, first-party domain alignment and current activity were verified. WXPN's official Contact page provides a first-party Email Music Director action, but its destination was left unresolved because it was not exposed in passive plaintext. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed.

Safety: No email, EPK, stream, download link, audio file, attachment, biography, lyric sheet, credits, metadata, personal information, rights declaration or payment was sent. No non-plaintext destination was decoded or guessed, no local eligibility was claimed, and no CAPTCHA, anti-bot, authentication, payment or platform restriction was entered or bypassed.
