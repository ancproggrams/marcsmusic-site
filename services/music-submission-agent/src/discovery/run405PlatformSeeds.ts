import type { PlatformInput } from '../models/types.js';

export const run405SeedPlatforms: PlatformInput[] = [
  {
    name: 'WXYC 89.3 FM Music Department Email Submission Route',
    websiteUrl: 'https://wxyc.org/',
    submissionUrl: 'https://wxyc.org/contact',
    sourceUrl: 'https://wxyc.org/contact',
    sourceType: 'automation_run_405_public_research',
    country: 'United States / Chapel Hill, North Carolina student-run freeform college radio with worldwide online listening',
    language: 'en',
    genres: [
      'college-radio',
      'freeform-radio',
      'independent-music',
      'electronic',
      'hip-hop',
      'reggae',
      'world-music',
      'house',
      'techno',
      'ambient',
      'underground-dance',
      'experimental',
      'cross-genre',
      'public-business-email',
      'authorized-email-submission-route',
      'authorized-physical-submission-alternative',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-department-email-or-postal-route',
    feeRequired: false,
    feeAmount:
      'WXYC publishes no submission fee, account, login or mandatory-payment requirement for the Music Department email route. Email is the free-first method. Optional physical-media production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WXYC’s official Contact page explicitly directs music submissions and distribution concerns to md@wxyc.org and publishes a Music Department postal address. The official pages do not state whether digital delivery should use attachments, public streams or downloadable links, nor do they publish audio formats, file-size limits, international eligibility, required metadata, release timing, explicit-content requirements or an AI-origin policy. A human must confirm the live requirements, select one genuinely suitable MarcsMusic release and use one route only. Do not send oversized attachments, duplicate email and physical packages, or contact individual DJs, outreach staff or the general mailbox as substitutes.',
    notes:
      'Verified on 2026-07-16 from WXYC’s official Contact, homepage, Programming, Blog and Archive pages. The Contact page states “Email music submissions or distribution concerns to md@wxyc.org” and separately publishes the WXYC Music Department postal address. The mailbox was verified by first-party plaintext publication, explicit music-submission purpose, valid syntax and exact wxyc.org domain alignment; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. Current operation was supported by WXYC’s 24-hours-a-day, 365-days-a-year programming statement, official posts dated May 11, June 7 and June 8, 2026, and archive content through the week of May 31, 2026. WXYC describes a freeform mix spanning any and all types of twentieth- and twenty-first-century music, while New Science Experience specifically includes house, techno, hip-hop, ambient and underground dance. No email, audio file, attachment, link, physical package, form field, login, CAPTCHA, consent or payment was submitted.'
  }
];
