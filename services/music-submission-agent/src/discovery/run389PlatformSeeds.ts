import type { PlatformInput } from '../models/types.js';

export const run389SeedPlatforms: PlatformInput[] = [
  {
    name: 'KKFI 90.1 FM Protected Music Librarian Digital Submission Route',
    websiteUrl: 'https://kkfi.org/',
    submissionUrl: 'https://kkfi.org/new-music-submissions/',
    sourceUrl: 'https://kkfi.org/new-music-submissions/',
    sourceType: 'automation_run_389_public_research',
    country: 'United States / Kansas City, Missouri community radio',
    language: 'en',
    genres: [
      'community-radio',
      'freeform-radio',
      'independent-music',
      'electronic',
      'hip-hop',
      'reggae',
      'world-music',
      'dub',
      'digital-download-link',
      'protected-email',
      'manual-review'
    ],
    submissionMethod: 'official-protected-music-librarian-email-digital-download-or-small-attachment-route',
    feeRequired: false,
    feeAmount: 'No music-submission fee or mandatory payment is stated on KKFI’s official New Music Submissions page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KKFI expressly accepts digital music through its Music Librarian route, but the destination is published through a protected first-party email link and was not decoded, guessed or copied into the automated dataset. A human must open the current official page, use only the displayed destination, choose a rights-cleared MarcsMusic release, prepare the preferred 300 kbps constant-bitrate MP3 or a supported cloud-download link, keep any direct attachments below 8 MB total, confirm that no separate player is required, add accurate release and routing context, verify international eligibility and the unpublished explicit-content and AI-origin rules, and send manually. KKFI’s updated May 2026 policy limits physical submissions to artists within its listening area, so MarcsMusic must not use the postal route.',
    notes:
      'Verified on 2026-07-16 from KKFI’s official New Music Submissions, Contact and homepage pages. The updated submission page dated May 8, 2026 states that digital music is preferred as MP3 encoded at 300 kbps constant bitrate, preferably through Google Drive, Dropbox, OneDrive or another accessible cloud route; Bandcamp, PlayMPE, AllMusic and SoundCloud are also named as accessible services. Direct attachments must remain below 8 MB total, and links requiring a separate player will not be reviewed. The official Contact page confirms that digital files are delivered to a protected Music Librarian address and forwarded to relevant show hosts. The current page restricts physical media to local artists effective May 1, 2026, superseding broader physical-delivery language remaining on the older Contact page. The protected email was not decoded or probed. Current operation was confirmed through homepage content dated July 8, 2026, current upcoming episodes and active Hip-Hop/Electronic and Reggae/World programming. No email, form field, stream, download link, attachment, audio file, physical package, login, CAPTCHA, consent or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  }
];
