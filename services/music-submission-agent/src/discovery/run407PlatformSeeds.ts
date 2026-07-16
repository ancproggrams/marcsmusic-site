import type { PlatformInput } from '../models/types.js';

export const run407SeedPlatforms: PlatformInput[] = [
  {
    name: 'SomaFM Channel-Specific Digital Music Submission Route',
    websiteUrl: 'https://somafm.com/',
    submissionUrl: 'https://somafm.com/contact/submitmusic.html',
    sourceUrl: 'https://somafm.com/contact/submitmusic.html',
    sourceType: 'automation_run_407_public_research',
    country: 'United States / San Francisco independent internet-radio network broadcasting worldwide',
    language: 'en',
    genres: [
      'internet-radio',
      'independent-music',
      'electronic',
      'ambient',
      'downtempo',
      'house',
      'trance',
      'dubstep',
      'dub',
      'reggae',
      'world-music',
      'instrumental-hip-hop',
      'future-soul',
      'experimental',
      'cross-genre',
      'public-business-email',
      'authorized-digital-submission-route',
      'channel-specific-routing',
      'download-link-required',
      'hard-ai-provenance-restriction',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-channel-specific-email-with-bandcamp-code-or-permissioned-download-link',
    feeRequired: false,
    feeAmount:
      'SomaFM publishes no submission fee, account login or mandatory-payment requirement for its channel-specific email routes. The route is free-first. Optional third-party storage or Bandcamp account costs are external and are not a SomaFM submission fee.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'SomaFM explicitly accepts digital submissions for a limited current set of channels through published first-party email addresses. A human must first confirm that the selected MarcsMusic release is not AI-generated or otherwise prohibited by SomaFM’s hard AI-music restriction, select exactly one appropriate accepting channel and mailbox, prepare either a Bandcamp link with a YUM download code or a permissioned WeTransfer/Dropbox-style download link, and verify compliant high-bitrate 44.1 kHz MP3 files and metadata. International eligibility is not expressly stated, channel acceptance and backlogs can change, and duplicate delivery to multiple music directors causes submissions to be ignored. No physical CD, SoundCloud, YouTube, Mixcloud, Facebook, Haulix, WAV, AIFF, FLAC or 128 kbps MP3 submission may be used.',
    notes:
      'Verified on 2026-07-16 from SomaFM’s official Submit Music, Contact and live homepage surfaces. The submission page publishes eight unique channel-specific business mailboxes in plaintext, including promosubmissions@somafm.com for a broad electronic, ambient and world-music channel group, and expressly supports commercial, independent, emerging and unsigned artists. Source, purpose, syntax and exact somafm.com domain alignment were verified; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. The official live homepage displayed more than 30 active commercial-free channels with current now-playing and listener information, including strong MarcsMusic fits in ambient, downtempo, electronica, dubstep, deep bass, reggae, world beats, instrumental hip-hop, future soul and house. No email, download link, Bandcamp code, audio file, attachment, metadata, form field, account, login, CAPTCHA, payment or physical package was submitted.'
  }
];
