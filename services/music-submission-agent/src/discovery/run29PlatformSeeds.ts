import type { PlatformInput } from '../models/types.js';

export const run29SeedPlatforms: PlatformInput[] = [
  {
    name: 'WFMU Freeform Radio Music Director Review Route',
    websiteUrl: 'https://wfmu.org/',
    submissionUrl: 'https://wfmu.org/sendmusic.html',
    sourceUrl: 'https://wfmu.org/sendmusic.html',
    sourceType: 'automation_run_29_public_research',
    country: 'United States / New Jersey and New York metropolitan area / freeform radio audience',
    language: 'en',
    genres: ['electronic', 'experimental', 'dub', 'reggae', 'indie', 'alternative', 'punk', 'jazz', 'world', 'freeform', 'radio-airplay', 'community-radio'],
    submissionMethod: 'public-physical-media-music-director-review-route-with-official-contact-page',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WFMU accepts materials for review through a public Music Director physical-media route and contact page, but preparation, mailing, rights/clean-content checks and non-automated outreach are required.',
    notes:
      'Official WFMU pages show active 2026 programming/archive activity, a Send Us Music route and a Music Director contact path. No package, upload, email or contact-form action was attempted.'
  },
  {
    name: 'WREK Atlanta 91.1 FM Submit Music Route',
    websiteUrl: 'https://www.wrek.org/',
    submissionUrl: 'https://old.wrek.org/submissions/',
    sourceUrl: 'https://old.wrek.org/submissions/',
    sourceType: 'automation_run_29_public_research',
    country: 'United States / Atlanta Georgia / Georgia Tech college-radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'dub', 'reggae', 'hip-hop', 'indie', 'alternative', 'experimental', 'noise', 'ambient', 'jazz', 'world', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-music-director-email-and-snail-mail-submission-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WREK lists official snail-mail and music.director@wrek.org routes, but does not acknowledge every submission, favors CDs/LPs, and requires human asset packaging, FCC-clean review and non-automated outreach.',
    notes:
      'Official WREK pages show current June 2026 programming/posts, detailed genre blocks and a public How To Submit Music page. No email, mail package, upload or login action was attempted.'
  },
  {
    name: 'WICB 91.7 FM Ithaca Submit Music Route',
    websiteUrl: 'https://wicb.org/',
    submissionUrl: 'https://wicb.org/',
    sourceUrl: 'https://wicb.org/',
    sourceType: 'automation_run_29_public_research',
    country: 'United States / Ithaca New York / college-radio and local-music audience',
    language: 'en',
    genres: ['alternative', 'indie', 'electronic', 'dance', 'reggae', 'hip-hop', 'blues', 'jazz', 'americana', 'local-music', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-site-submit-music-navigation-route-with-spa-content-requiring-manual-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WICB exposes a public Submit Music navigation route, but the page content is SPA/dynamic and did not expose a safe static form or email in this run, so the route must be opened and verified manually without bypassing site behavior.',
    notes:
      'WICB is an active Ithaca College station with online streaming, specialty/local music programming and a visible Submit Music navigation item. No dynamic page interaction, form submission, account action or contact attempt was performed.'
  },
  {
    name: 'WXYC 89.3 FM Chapel Hill Music Department Route',
    websiteUrl: 'https://wxyc.org/',
    submissionUrl: 'https://wxyc.org/',
    sourceUrl: 'https://wxyc.org/',
    sourceType: 'automation_run_29_public_research',
    country: 'United States / Chapel Hill North Carolina / UNC student-run freeform radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'dub', 'reggae', 'hip-hop', 'indie', 'alternative', 'experimental', 'metal', 'jazz', 'world', 'freeform', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-music-department-contact-and-mailing-address-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WXYC publishes a Music Department mailing route and general contact path, but no safe static submission form was identified, so music-package preparation and route confirmation require manual review.',
    notes:
      'Official WXYC site confirms student-run freeform activity, recent 2026 posts and a Music Department address/contact route. No email, physical mailing, upload or form action was attempted.'
  }
];
