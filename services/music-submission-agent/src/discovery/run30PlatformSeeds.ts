import type { PlatformInput } from '../models/types.js';

export const run30SeedPlatforms: PlatformInput[] = [
  {
    name: 'WTJU 91.1 FM UVA Submit Music Route',
    websiteUrl: 'https://www.wtju.net/',
    submissionUrl: 'https://www.wtju.net/submit-music/',
    sourceUrl: 'https://www.wtju.net/submit-music/',
    sourceType: 'automation_run_30_public_research',
    country: 'United States / Charlottesville Virginia / UVA community-radio audience',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'dub',
      'reggae',
      'hip-hop',
      'indie',
      'alternative',
      'jazz',
      'blues',
      'folk',
      'world',
      'rock',
      'r-and-b',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-submit-music-page-with-genre-specific-email-and-physical-digital-routes',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WTJU publishes public mail and digital-file guidance plus genre-specific contacts, but music director selection, stream-vs-library rules, rights, explicit-content and asset packaging require human review before outreach.',
    notes:
      'Official WTJU pages show a Submit Music route accepting CD, vinyl and MP3/WAV/FLAC files, with streaming links permitted only for review. No email, upload, account, payment or form action was attempted.'
  },
  {
    name: 'WUVT-FM 90.7 Blacksburg Physical Music Submission Route',
    websiteUrl: 'https://www.wuvt.vt.edu/',
    submissionUrl: 'https://www.wuvt.vt.edu/staff',
    sourceUrl: 'https://www.wuvt.vt.edu/staff',
    sourceType: 'automation_run_30_public_research',
    country: 'United States / Blacksburg Virginia / Virginia Tech freeform college-radio audience',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'experimental',
      'indie',
      'alternative',
      'hip-hop',
      'punk',
      'hardcore',
      'rock',
      'reggae',
      'freeform',
      'college-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-staff-page-music-director-email-for-physical-submissions-only',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WUVT explicitly accepts physical music submissions only and asks artists to email the Music Director first; physical preparation, mailing, current-staff verification and FCC-clean checks require owner/manual review.',
    notes:
      'Official WUVT pages show 2026-2027 staffheads, Music Director contact and a warning that digital submissions are not accepted. No email, mailing, upload, login or form action was attempted.'
  },
  {
    name: 'KXCI 91.3 Tucson Music Department Submission Route',
    websiteUrl: 'https://kxci.org/',
    submissionUrl: 'https://kxci.org/about/music-department/',
    sourceUrl: 'https://kxci.org/about/music-department/',
    sourceType: 'automation_run_30_public_research',
    country: 'United States / Tucson Arizona / community-radio and regional independent music audience',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'dub',
      'reggae',
      'cumbia',
      'latin',
      'latin-jazz',
      'hip-hop',
      'indie',
      'alternative',
      'americana',
      'blues',
      'jazz',
      'punk',
      'folk',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-music-department-email-and-physical-submission-guidelines',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KXCI accepts worldwide digital and physical submissions, but notes high volume, local/regional prioritization and review for genre, quality and explicit content; human curation and asset verification are required.',
    notes:
      'Official KXCI Music Department page lists required metadata, MP3/WAV download-link route, CD/vinyl mailing route and explicit-content review. No email, form, payment, login or upload action was attempted.'
  }
];
