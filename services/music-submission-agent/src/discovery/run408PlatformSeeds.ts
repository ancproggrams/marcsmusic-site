import type { PlatformInput } from '../models/types.js';

export const run408SeedPlatforms: PlatformInput[] = [
  {
    name: 'KXCI 91.3 FM International Digital and Physical Music Submission Route',
    websiteUrl: 'https://kxci.org/',
    submissionUrl: 'https://kxci.org/about/music-department/',
    sourceUrl: 'https://kxci.org/about/music-department/',
    sourceType: 'automation_run_408_public_research',
    country: 'United States / Tucson, Arizona community radio accepting music from all over the world',
    language: 'en',
    genres: [
      'community-radio',
      'freeform-radio',
      'independent-music',
      'electronic',
      'electro-pop',
      'hip-hop',
      'reggae',
      'world-music',
      'experimental',
      'cross-genre',
      'protected-public-business-email',
      'authorized-digital-submission-route',
      'authorized-physical-submission-alternative',
      'international-artists-explicitly-accepted',
      'download-link-required',
      'explicit-content-disclosure-required',
      'capacity-gated',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-protected-music-department-email-with-mp3-or-wav-download-link-and-physical-alternative',
    feeRequired: false,
    feeAmount:
      'KXCI publishes no submission fee, account login or mandatory-payment requirement for its Music Department route. Digital delivery is free-first. Optional CD or vinyl production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KXCI explicitly accepts music from all over the world and authorizes digital MP3 or WAV download-link submissions through a protected first-party Music Department email action, plus an international physical CD or vinyl alternative. The email destination is Cloudflare-protected in passive retrieval and must not be decoded, guessed or inferred. A human must open the official page normally, select one suitable MarcsMusic release, verify whether singles are accepted because the page describes digital albums, provide the required artwork, tracklist, timings, release date, genre, similar artists, explicit-language disclosure, biography and contact information, and confirm any unpublished AI-origin or release-window rules before sending. KXCI receives more than 500 submissions weekly and cannot review or broadcast every release. Do not automate the protected email action or send both digital and physical versions unless a human intentionally chooses the optional physical route.',
    notes:
      'Verified on 2026-07-16 from KXCI’s official Music Department, homepage and current programme pages. The Music Department page expressly accepts music from all over the world, authorizes MP3 or WAV download links for digital albums, publishes separate local and national/international physical-delivery instructions, and requires artist, release, tracklist, timing, label or self-release status, release date, genre, similar-artist, explicit-content, biography, social, performance and contact details. The designated Music Department email action is first-party and purpose-specific but Cloudflare-protected in passive retrieval, so no plaintext address was stored and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. Current activity was supported by July 2026 homepage posts, active schedules, live-stream and playlist surfaces, and current programmes spanning world music, hip-hop, electronic, electro-pop, reggae and experimental formats. No email, download link, audio file, attachment, form field, physical package, login, CAPTCHA, consent or payment was submitted.'
  }
];
