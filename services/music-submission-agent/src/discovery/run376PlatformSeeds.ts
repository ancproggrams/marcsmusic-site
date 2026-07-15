import type { PlatformInput } from '../models/types.js';

export const run376SeedPlatforms: PlatformInput[] = [
  {
    name: 'Flirt FM 101.3 First-Party Music Submission Form',
    websiteUrl: 'https://flirtfm.ie/',
    submissionUrl: 'https://flirtfm.ie/',
    sourceUrl: 'https://flirtfm.ie/',
    sourceType: 'automation_run_376_public_research',
    country: 'Ireland / Galway student and community-of-interest radio',
    language: 'en',
    genres: [
      'alternative',
      'independent',
      'electronic',
      'ambient',
      'dub',
      'reggae',
      'hip-hop',
      'afrobeat',
      'world-music',
      'student-radio',
      'community-radio',
      'web-form-submission',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-submission-form',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated on the public first-party page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Flirt FM’s official homepage exposes a dedicated Music Submission form/tab, but passive rendering does not reveal the live fields, accepted assets, validation, consent, CAPTCHA, login or payment controls. Public guidance also does not expressly confirm international eligibility, accepted release types, file or link rules, metadata, release windows, explicit-content handling or AI-origin policy. A human must open the first-party route, inspect all live controls without bypassing them, select a suitable MarcsMusic release, submit manually only if permitted, and stop if CAPTCHA, authentication, payment, consent or any restriction appears.',
    notes:
      'Verified on 2026-07-15 from Flirt FM 101.3’s official first-party homepage. The Contact the Studio section visibly provides a dedicated Music Submission option alongside separate General Queries, Volunteering and anniversary contact options. Passive inspection did not expose the form fields or submission controls, so absence of CAPTCHA, login or payment was not assumed. No purpose-bound public music-submission email was observed; no general, staff, volunteering, studio-booking or other adjacent contact was inferred or substituted. Current activity was confirmed through a 24/7 webstream, current 2026 station content and programming categories including electronic, ambient, dub, reggae, hip-hop, afrobeat, alternative, indie and world music. No form field, cookie choice, file, link, login, CAPTCHA, consent or payment was entered or submitted.'
  }
];
