import type { PlatformInput } from '../models/types.js';

export const run373SeedPlatforms: PlatformInput[] = [
  {
    name: 'CIUT 89.5 FM New Music Submission Email Route',
    websiteUrl: 'https://ciut.fm/',
    submissionUrl: 'https://ciut.fm/contact/',
    sourceUrl: 'https://ciut.fm/contact/',
    sourceType: 'automation_run_373_public_research',
    country: 'Canada / Toronto, Ontario campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'dub',
      'reggae',
      'hip-hop',
      'global-music',
      'campus-radio',
      'community-radio',
      'email-submission',
      'digital-music-submission',
      'manual-review'
    ],
    submissionMethod: 'official-new-music-email-published-on-station-contact-page',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CIUT expressly directs music submissions to newmusic@ciut.fm, but its public Contact page does not state accepted release types, minimum track count, attachment-versus-download-link rules, audio formats, bitrate, metadata, release timing, international eligibility, explicit-content handling or AI-origin restrictions. A human must recheck the current instruction, select a suitable MarcsMusic release, prepare only permitted assets or links, send manually to the published mailbox, and stop if a login, CAPTCHA, payment, consent request or updated restriction appears.',
    notes:
      'Verified on 2026-07-15 from CIUT-FM’s official Contact, Schedule and About pages. The Contact page explicitly states “Contact newmusic@ciut.fm to submit music.” The official schedule is active and includes The New Music Hour, Global Rhythms, Electric Sense, DJ Mixes, Reggae Riddims, Groove Concept Radio and Sticky Icky Reggae, creating a plausible fit for selected MarcsMusic electronic, dub, reggae, hip-hop and global-fusion releases without implying review or airplay. The About page states that CIUT broadcasts 24 hours a day, seven days a week, all year. Email verification covered first-party publication, valid syntax, official ciut.fm domain alignment and explicit submission purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, file, link, form, login, CAPTCHA or payment was submitted.'
  }
];
