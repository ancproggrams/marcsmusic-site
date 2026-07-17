import type { PlatformInput } from '../models/types.js';
import { run414SeedPlatforms } from './run414PlatformSeeds.js';

export const run413SeedPlatforms: PlatformInput[] = [
  {
    name: 'WNYO 88.9 FM Genre-Routed Music Submission Email Opportunity',
    websiteUrl: 'https://wnyo889.org/',
    submissionUrl: 'https://wnyo889.org/submissions/',
    sourceUrl: 'https://wnyo889.org/submissions/',
    sourceType: 'automation_run_413_public_research',
    country:
      'United States / SUNY Oswego student radio in Oswego, New York with worldwide online streaming and international artist eligibility not explicitly stated',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-music',
      'electronic',
      'electronic-beats',
      'world-music',
      'non-english-music',
      'pop',
      'specialty',
      'hip-hop',
      'rap',
      'r-and-b',
      'alternative',
      'indie',
      'folk',
      'punk',
      'cross-genre',
      'authorized-digital-submission-route',
      'genre-routed-email-submission',
      'public-business-email',
      'free-first',
      'international-eligibility-unconfirmed',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-genre-routed-business-email-with-manual-confirmation-of-current-audio-delivery-requirements',
    feeRequired: false,
    feeAmount:
      'WNYO publishes no submission fee, account login, CAPTCHA or mandatory payment for its music-submission email routes. Delivery format, attachment limits and link requirements are not published and must be confirmed manually before sending assets.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WNYO explicitly states that it is currently accepting music in defined genre categories and publishes purpose-specific submission mailboxes. For MarcsMusic, the Other Genres route covers electronic beats, non-English/world, pop and specialty music; a general music-submissions-only mailbox is also published. A human must choose exactly one best-fit mailbox, confirm international eligibility, accepted release type, attachment-versus-download-link procedure, audio format and size limits, required metadata, explicit-content rules, release timing and AI-origin policy, then send one individualized submission manually. Do not send the same release to multiple WNYO mailboxes or use student, syndicated-programme, general-inquiry, comment or social routes as substitutes.',
    notes:
      'Verified on 2026-07-17 from WNYO’s official Submissions, homepage, Programming, Shows, Contact and E-Board surfaces. The submissions page says WNYO is currently accepting Alternative, Hip-Hop and Other Genres music and publishes wnyoalternative@gmail.com, hiphopwnyo@gmail.com and musicwnyo@gmail.com for those categories. The site footer independently publishes music@wnyo889.org as MUSIC SUBMISSIONS ONLY. MarcsMusic has plausible fit through the Other Genres category, which expressly includes Electronic Beats, Non-English/World, Pop and Specialty. Current operation is supported by two live stream surfaces, a populated seven-day schedule, now-on-air and up-next programming, current named directors and a notice that email is the best contact method during summer and winter breaks. No dedicated upload form, CAPTCHA, login or payment requirement was identified. No email, audio, attachment, link, form field, account or payment was submitted.'
  },
  ...run414SeedPlatforms
];
