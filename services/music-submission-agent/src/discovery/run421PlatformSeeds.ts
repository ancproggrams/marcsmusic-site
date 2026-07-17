import type { PlatformInput } from '../models/types.js';

export const run421SeedPlatforms: PlatformInput[] = [
  {
    name: 'Radio Nano Free International Digital Music-Submission Opportunity',
    websiteUrl: 'https://radionano.com/',
    submissionUrl: 'https://radionano.com/submit-your-music/',
    sourceUrl: 'https://radionano.com/submit-your-music/',
    sourceType: 'automation_run_421_public_research',
    country:
      'Norway / Oslo web-based radio; the official submission page explicitly welcomes local and international acts',
    language: 'en',
    genres: [
      'independent-radio',
      'web-radio',
      'international-artists',
      'emerging-artists',
      'popular-music',
      'pop',
      'electronic-pop',
      'dance-pop',
      'edm-crossover',
      'digital-submission-form',
      'authorized-submission-email-alternative',
      'audio-attachment-or-online-link',
      'one-page-press-release-or-bio',
      'all-rights-required',
      'cover-and-sample-clearance-required',
      'site-level-anti-bot-verification-observed',
      'no-visible-payment-requirement',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-digital-submission-form-or-authorized-music-submission-email-with-a-song-attachment-or-online-link-and-one-page-press-release-or-bio',
    feeRequired: false,
    feeAmount:
      'The official music-submission page does not publish a fee or paid prerequisite for either the form or the authorized email alternative.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Radio Nano explicitly welcomes local and international acts and authorizes both its first-party submission form and music@radionano.com. However, the live submission page presented a site-level browser-verification screen during passive access, and no CAPTCHA was solved or bypassed. A human must choose one route, select a suitable radio-ready track, verify ownership and permissions from every contributor and right-holder, confirm cover and sample clearance, inspect the one-page press release or bio, confirm attachment or link access, file format and size limits, explicit-content handling, release timing and the current AI-assisted or AI-generated music policy, then submit manually.',
    notes:
      'Verified on 2026-07-17 from Radio Nano’s official Submit Your Music, About, Home, Events and Privacy Policy pages. The station is a web-based radio service established in Oslo and explicitly accepts local and international acts. Its preferred route is the dedicated digital form; the same official page authorizes email delivery to music@radionano.com using a song attachment or online-service link plus a one-page press release or bio. The form exposes name, email, role, message including song URL and upload fields. The rights notice requires permission from all right-holders and contributors and explicitly covers cover songs and sampled music. Current activity is supported by a live-player page, May 2026 news and privacy updates, and 2026 event listings. Passive opening of the submission page returned a browser-verification loader, so no form interaction or challenge bypass occurred. No email, form field, audio, attachment, link, consent, login, CAPTCHA or payment was submitted.'
  }
];
