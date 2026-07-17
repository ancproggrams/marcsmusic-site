import type { PlatformInput } from '../models/types.js';
import { run423SeedPlatforms } from './run423PlatformSeeds.js';

export const run422SeedPlatforms: PlatformInput[] = [
  {
    name: 'Variety Vibes Radio & TV Global All-Genre Artist-Submission Form Opportunity',
    websiteUrl: 'https://varietyvibesradio.com/',
    submissionUrl: 'https://varietyvibesradio.com/music-submission/',
    sourceUrl: 'https://varietyvibesradio.com/music-submission/',
    sourceType: 'automation_run_422_public_research',
    country:
      'United States / Portland, Oregon global online radio and TV network; official pages state that the platform serves and amplifies artists worldwide',
    language: 'en',
    genres: [
      'independent-radio',
      'global-radio',
      'radio-and-tv',
      'all-genres',
      'electronic',
      'hip-hop',
      'r-and-b',
      'pop',
      'rock',
      'jazz',
      'gospel',
      'country',
      'reggae-dancehall',
      'world-afrobeats',
      'metal-alternative',
      'experimental',
      'classical-instrumental',
      'folk-acoustic',
      'latin',
      'digital-submission-form',
      'audio-or-video-upload',
      'cover-art-and-press-photo',
      'rights-and-broadcast-license',
      'promotional-media-license',
      'separate-paid-promotion-services',
      'no-visible-login-captcha-or-mandatory-payment',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-artist-submission-form-with-mp3-wav-or-mp4-upload-cover-art-press-photo-bio-social-links-and-rights-agreement',
    feeRequired: false,
    feeAmount:
      'The official artist-submission form does not display a mandatory fee or payment field. Separate optional promotion, interview, website-feature, airplay-package and broadcasting services are publicly priced and must not be selected or purchased without human approval.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The form requires ownership and distribution-rights confirmation plus acceptance of a legally binding submission agreement granting a non-exclusive worldwide royalty-free perpetual content and promotional-media license. A second Radio Airplay & Promotion Agreement is hosted on a JavaScript-dependent external HiDrive page and could not be passively reviewed. A human must read every current agreement, verify age and authority, select one suitable broadcast-ready track, inspect MP3/WAV/MP4, cover art, press photo, biography and links, confirm explicit-content and AI-origin eligibility, avoid optional paid services unless separately approved, recheck the live form for CAPTCHA, login, payment or anti-spam controls, and submit manually.',
    notes:
      'Verified on 2026-07-17 from Variety Vibes Radio & TV’s official Home, Music Submission, Contact, Services, Artists, Blog and Terms pages. Rolling Admissions 2026 are open for all genres. The form accepts MP3, WAV or MP4 up to 50 MB at 192 kbps or better, requires 3000×3000 JPG/PNG cover art, requests a press photo up to 10 MB, artist identity, city/country, career and label status, genre, release history, social and streaming links, a biography, interests and additional notes, and states a 14-business-day response target. The official terms require ownership or licenses and grant broad broadcast, display and promotional rights without compensation. support@varietyvibesradio.com is a first-party general support/management mailbox and is excluded from music delivery because the dedicated form is the authorized route. Current activity is supported by 2026 rolling admissions, featured audio uploaded through May 2026 and blog posts dated June 2026. No form field, upload, agreement, email, login, CAPTCHA, payment or paid service was submitted.'
  },
  ...run423SeedPlatforms
];
