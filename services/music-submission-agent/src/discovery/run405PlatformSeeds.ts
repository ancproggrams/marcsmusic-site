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
      'published-postal-contact-unconfirmed-for-music-delivery',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-department-email-with-unconfirmed-postal-contact',
    feeRequired: false,
    feeAmount:
      'WXYC publishes no submission fee, account, login or mandatory-payment requirement for the Music Department email route. The published postal address is a contact point, not confirmed authorization for sending physical music; physical-media production and postage must not be incurred without station confirmation.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WXYC’s official Contact page explicitly directs music submissions and distribution concerns to md@wxyc.org and separately publishes a Music Department postal address. The postal address is not treated as authorization to send unsolicited physical media. The official pages do not state whether digital delivery should use attachments, public streams or downloadable links, nor do they publish audio formats, file-size limits, international eligibility, required metadata, release timing, explicit-content requirements or an AI-origin policy. A human must confirm the live requirements and select one genuinely suitable MarcsMusic release. Do not send oversized attachments, mail a physical package without express confirmation, or contact individual DJs, outreach staff or the general mailbox as substitutes.',
    notes:
      'Verified on 2026-07-16 from WXYC’s official Contact, homepage, Programming, Blog and Archive pages. The Contact page states “Email music submissions or distribution concerns to md@wxyc.org” and separately publishes the WXYC Music Department postal address. Only the email is treated as an authorized music-submission route; the postal address is retained as a public contact requiring confirmation before any physical delivery. The mailbox was verified by first-party plaintext publication, explicit music-submission purpose, valid syntax and exact wxyc.org domain alignment; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. Current operation was supported by WXYC’s 24-hours-a-day, 365-days-a-year programming statement, official posts dated May 11, June 7 and June 8, 2026, and archive content through the week of May 31, 2026. WXYC describes a freeform mix spanning any and all types of twentieth- and twenty-first-century music, while New Science Experience specifically includes house, techno, hip-hop, ambient and underground dance. No email, audio file, attachment, link, physical package, form field, login, CAPTCHA, consent or payment was submitted.'
  }
];
