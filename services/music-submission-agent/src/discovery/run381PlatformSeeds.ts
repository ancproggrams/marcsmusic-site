import type { PlatformInput } from '../models/types.js';

export const run381SeedPlatforms: PlatformInput[] = [
  {
    name: 'BayFM 99.9 Byron Bay Music Contact Form Pre-Submission Inquiry Route',
    websiteUrl: 'https://www.bayfm.org/',
    submissionUrl: 'https://www.bayfm.org/about/contact/',
    sourceUrl: 'https://www.bayfm.org/about/contact/',
    sourceType: 'automation_run_381_public_research',
    country: 'Australia / Byron Bay, New South Wales community radio',
    language: 'en',
    genres: [
      'community-radio',
      'independent',
      'electronic',
      'electronica',
      'house',
      'techno',
      'dance',
      'lofi',
      'dub',
      'reggae',
      'dancehall',
      'world-music',
      'digital-beats',
      'multicultural',
      'contact-form',
      'pre-submission-inquiry',
      'captcha',
      'manual-review'
    ],
    submissionMethod: 'official-public-contact-form-music-category-asset-free-pre-submission-inquiry',
    feeRequired: false,
    feeAmount: 'No fee or mandatory payment is stated for the official contact form.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'BayFM’s official Contact page offers a public form with a dedicated Music subject, optional genre field, message field and CAPTCHA, but it does not expressly authorize unsolicited audio delivery or publish attachment, streaming-link, download-link, metadata, release-window, international-eligibility, explicit-content or AI-origin rules. A human may use the Music category only for an asset-free inquiry asking for the current airplay-submission process, must complete the CAPTCHA manually, and must not send music, files or private links until BayFM confirms an authorized route and requirements.',
    notes:
      'Verified on 2026-07-15 from BayFM’s official Contact page, homepage, Music News archive and current Program Guide. The Contact page states that enquiries are routed to the appropriate place and exposes subject options including Music, plus a genre field, message field and CAPTCHA. No purpose-bound public music-submission email was observed, and the published street address was not interpreted as authorization for physical music delivery. The station’s active schedule includes lofi and dance, house, Balearic and dub, electronica and techno, reggae, dub, ska and dancehall, multicultural and world-music programming, providing a plausible MarcsMusic fit without implying acceptance or airplay. Repository code search and full pull-request patch inspection found no prior BayFM or bayfm.org submission record. No form field, CAPTCHA, email, file, link, physical package, login, consent or payment was entered or submitted.'
  }
];
