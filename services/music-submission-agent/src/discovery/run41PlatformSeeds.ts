import type { PlatformInput } from '../models/types.js';

export const run41SeedPlatforms: PlatformInput[] = [
  {
    name: 'KXT 91.7 Dallas Music Submissions',
    websiteUrl: 'https://kxt.org/',
    submissionUrl: 'https://kxt.org/submissions/',
    sourceUrl: 'https://kxt.org/submissions/',
    sourceType: 'automation_run_41_public_research',
    country: 'United States / Dallas-Fort Worth public radio and music discovery',
    language: 'en',
    genres: [
      'indie',
      'alternative',
      'americana',
      'singer-songwriter',
      'world',
      'latin',
      'jazz',
      'north-texas',
      'radio-airplay',
      'public-radio'
    ],
    submissionMethod: 'official-public-digital-airplay-consideration-wufoo-form',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KXT publishes an official Music Submissions page with a digital Wufoo-style form, one-song limit, streaming and WAV download requirements, and an on-air authorization statement. Manual review is required for song selection, release context, metadata, rights authorization and external-form validation before any submission is made.',
    notes:
      'Official KXT Music Submissions page asks artists to submit just one song, provide a streaming link and a downloadable WAV 44.1/16 file, and confirms the submitted song may be aired. The form was identified but no form, upload, email or authorization step was submitted.'
  },
  {
    name: 'KUTX 98.9 Austin On-Air Rotation Music Submissions',
    websiteUrl: 'https://kutx.org/',
    submissionUrl: 'https://kutx.org/submit-your-music/',
    sourceUrl: 'https://kutx.org/submit-your-music/',
    sourceType: 'automation_run_41_public_research',
    country: 'United States / Austin and Texas public radio',
    language: 'en',
    genres: [
      'electronic',
      'experimental',
      'latin',
      'hip-hop',
      'r-and-b',
      'indie',
      'jazz',
      'austin',
      'texas-music',
      'public-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-music-director-email-route-with-specialty-show-routing',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KUTX publishes an official on-air rotation submission route through the Music Director and separate specialty-show guidance. Manual review is required for Austin/Texas flagging, clean radio edit checks, mastered-track selection, WAV-download link preparation and avoiding non-submission routes such as paid sponsorship.',
    notes:
      'Official KUTX Submit Your Music page lists music@kutx.org, subject-line guidance, streaming-link and WAV-download requirements, radio-edit/FCC guidance and specialty shows including electronic/experimental, Latin, hip-hop/R&B, jazz and new music. No email, Qualtrics form, event promotion route or paid sponsorship route was used.'
  },
  {
    name: 'WERS 88.9FM Wicked Local Wednesday Music Submission',
    websiteUrl: 'https://wers.org/',
    submissionUrl: 'https://wers.org/wicked-local-wednesday/',
    sourceUrl: 'https://wers.org/wicked-local-wednesday/',
    sourceType: 'automation_run_41_public_research',
    country: 'United States / Boston local music feature',
    language: 'en',
    genres: [
      'boston-local',
      'indie',
      'pop',
      'rock',
      'soul',
      'r-and-b',
      'hip-hop',
      'radio-airplay',
      'local-music'
    ],
    submissionMethod: 'official-public-local-music-upload-form-recaptcha',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WERS publishes an official local-music submission form for Wicked Local Wednesday with contact, link and MP3 upload fields, and the page is protected by reCAPTCHA. Manual review is required for Boston-area eligibility, file choice, rights/clean-edit checks and because CAPTCHA/anti-bot controls must not be bypassed.',
    notes:
      'Official WERS Wicked Local Wednesday page invites local bands/artists to submit music, exposes a public form with required contact fields and MP3 upload, and states the site is protected by reCAPTCHA. No form fields were completed, no upload was attempted and no CAPTCHA control was bypassed.'
  },
  {
    name: 'WYEP 91.3 Pittsburgh Area Music Submissions',
    websiteUrl: 'https://www.wyep.org/',
    submissionUrl: 'https://www.wyep.org/wyep-pittsburgh-area-music-submissions',
    sourceUrl: 'https://www.wyep.org/wyep-pittsburgh-area-music-submissions',
    sourceType: 'automation_run_41_public_research',
    country: 'United States / Pittsburgh and Western Pennsylvania public radio',
    language: 'en',
    genres: [
      'pittsburgh-local',
      'western-pennsylvania',
      'indie',
      'americana',
      'singer-songwriter',
      'rock',
      'public-radio',
      'radio-airplay',
      'local-music'
    ],
    submissionMethod: 'official-public-local-music-email-and-hard-copy-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WYEP publishes an official Pittsburgh-area music submission route via localmusic@wyep.org or hard copy, with Western Pennsylvania/local-show eligibility and FCC-clean guidance. Manual review is required for location eligibility, track/package choice, clean-edit checks and owner approval before any outbound contact.',
    notes:
      'Official WYEP Pittsburgh Area Music Submissions page says artists can email a music link to localmusic@wyep.org or mail a hard copy, highlights The Local 913 and Pittsburgh Music Hour, and asks for contact info, where the artist is from, preferred tracks and clean radio edits. No email or physical mail was sent.'
  },
  {
    name: 'Toolroom Records Demo Submission',
    websiteUrl: 'https://toolroomrecords.com/',
    submissionUrl: 'https://toolroomrecords.com/demos/',
    sourceUrl: 'https://toolroomrecords.com/demos/',
    sourceType: 'automation_run_41_public_research',
    country: 'United Kingdom / global electronic dance label',
    language: 'en',
    genres: [
      'house',
      'tech-house',
      'electronic',
      'dance',
      'club',
      'dj',
      'label-demo',
      'a-and-r'
    ],
    submissionMethod: 'official-public-demo-upload-page-label-a-and-r-review',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Toolroom publishes an official Submit your demo page asking artists to upload demos. Manual review is required for unreleased-demo suitability, A&R package, rights ownership, metadata, label fit and any page-level upload/session/cookie validation before using the route.',
    notes:
      'Official Toolroom Demos page says to upload demos via the page and that the A&R team listens to submissions but cannot reply to every submission. The Toolroom site also publishes public business contacts and current 2026 site activity. No demo upload, sign-up, cookie/action, email or form submission was attempted.'
  }
];
