import type { PlatformInput } from '../models/types.js';

export const run379SeedPlatforms: PlatformInput[] = [
  {
    name: 'WREK 91.1 FM Authorized Music Director Submission',
    websiteUrl: 'https://www.wrek.org/',
    submissionUrl: 'mailto:music.director@wrek.org',
    sourceUrl: 'https://old.wrek.org/submissions/',
    sourceType: 'automation_run_379_public_research',
    country: 'United States / Atlanta, Georgia college radio',
    language: 'en',
    genres: [
      'electronic',
      'ambient',
      'experimental',
      'house',
      'techno',
      'breaks',
      'edm',
      'reggae',
      'dub',
      'hip-hop',
      'world',
      'afrobeat',
      'independent',
      'college-radio',
      'manual-review'
    ],
    submissionMethod: 'official-music-director-email-and-authorized-physical-delivery',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated on the official submission guidance.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The current WREK site links to the official submission guidance and the guidance authorizes music.director@wrek.org plus physical delivery, but it does not fully specify digital attachment-versus-link handling, current file-size limits, required metadata, eligible release types, international eligibility, explicit-content rules or AI-origin policy. The old guidance lists 350 Ferst Drive while the current site publishes 351 Ferst Drive NW, so a human must confirm the current postal address before any physical shipment. A reviewer must select an eligible MarcsMusic release, verify rights and prior-submission status, confirm current requirements directly from the first-party route and submit manually only if compliant.',
    notes:
      'Verified on 2026-07-15. WREK’s current first-party Music page links “Submit Songs to Us” to the official old.wrek.org submission guidance. That guidance publishes music.director@wrek.org, accepts independently produced music and states that common media formats can be submitted, with CDs and LPs receiving stronger consideration. The current station operates 24/7 and published playlists dated through July 10, 2026. Programming includes electronic, ambient, experimental, house, techno, breaks, EDM, reggae, dub, hip-hop, international and Afrobeat. The mailbox is plaintext, purpose-bound and aligned with wrek.org. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, file, link or physical package was submitted.'
  },
  {
    name: 'WPRB 103.3 FM Authorized Music Director Submission',
    websiteUrl: 'https://wprb.com/',
    submissionUrl: 'mailto:music@wprb.com',
    sourceUrl: 'https://wprb.com/music-submissions/',
    sourceType: 'automation_run_379_public_research',
    country: 'United States / Princeton, New Jersey independent radio',
    language: 'en',
    genres: [
      'independent',
      'new-music',
      'electronic',
      'experimental',
      'reggae',
      'world',
      'hip-hop',
      'freeform',
      'college-radio',
      'manual-review'
    ],
    submissionMethod: 'official-music-submission-email-and-authorized-physical-delivery',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated on the official music-submissions page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WPRB explicitly authorizes music@wprb.com and physical submissions, while prioritizing physical media, but the public page does not state whether emailed music should use attachments or downloadable links, accepted digital formats or sizes, required metadata, eligible release types, release windows, international eligibility, explicit-content rules or AI-origin policy. A human must confirm the current email-delivery requirements, select an eligible MarcsMusic release, verify rights and prior-submission status, and submit manually only if fully compliant. Physical manufacturing, postage and customs costs require separate approval.',
    notes:
      'Verified on 2026-07-15 from WPRB’s official first-party Music Submissions page. It accepts CDs, CD-Rs, LPs, 12-inch, 10-inch and 7-inch physical releases at the published Music Director postal address and also authorizes music@wprb.com, while stating that physical submissions are prioritized. The mailbox is plaintext, purpose-bound and aligned with wprb.com. Current operation was confirmed through a live now-playing state, a summer schedule, recent playlists dated July 13, 2026 and upcoming July 2026 concert listings. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, file, link or physical package was submitted.'
  }
];
