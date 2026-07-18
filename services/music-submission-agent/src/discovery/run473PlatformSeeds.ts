import type { PlatformInput } from '../models/types.js';
import { run474SeedPlatforms } from './run474PlatformSeeds.js';

export const run473SeedPlatforms: PlatformInput[] = [
  {
    name: 'Most FM Alternative Music Submission',
    websiteUrl: 'https://mostfm.co.nz/',
    submissionUrl: 'https://mostfm.co.nz/submit-music/',
    sourceUrl: 'https://mostfm.co.nz/submit-music/',
    sourceType: 'automation_run_473_public_research',
    country:
      'New Zealand (New Plymouth, Taranaki); the station has worldwide listeners, but international-artist submission eligibility is not explicitly confirmed.',
    language: 'en',
    genres: [
      'alternative',
      'indie',
      'electronic',
      'reggae',
      'world',
      'blues',
      'jazz',
      'singer-songwriter',
      'single-focused',
      'track-link',
      'public-form',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public music-submission form requiring a streaming link and a downloadable audio link',
    feeRequired: false,
    feeAmount: 'No submission fee, checkout or payment requirement is published on the first-party route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The active first-party form is strongly genre-relevant, but international and AI eligibility, clean-edit selection, link accessibility and permissions, metadata, music rights, hidden anti-spam controls and the final submit action require human approval.',
    notes:
      'Passively verified on 2026-07-18 from the official submission, home, schedule, contact and current 2026 event pages. The form requests one focus single, streaming and download links, artist and song names, origin/base, release date, explicit-lyrics disclosure and a short message. WAV, MP3 and M4A are accepted. No field was filled, no link was submitted, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  {
    name: 'The Detour Network Freeform Radio Music Submission',
    websiteUrl: 'https://thedetour.us/',
    submissionUrl: 'https://thedetour.us/submit_music.php',
    sourceUrl: 'https://thedetour.us/submit_music.php',
    sourceType: 'automation_run_473_public_research',
    country:
      'United States (Tennessee); the station broadcasts worldwide online and its submission terms expressly address music submitted from foreign jurisdictions.',
    language: 'en',
    genres: [
      'alternative',
      'rap',
      'reggae',
      'pop',
      'techno',
      'blues',
      'jazz',
      'world',
      'freeform',
      'email-attachment',
      'physical-media-alternative',
      'royalty-waiver',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public music-submission mailbox for MP3, WAV or AAC attachments, with postal CD delivery as an alternative',
    feeRequired: false,
    feeAmount: 'No submission fee, checkout or mandatory payment is published for the email or postal route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The specific public mailbox is authorized and active, but audio attachment preparation, ID3 and filename rules, clean/explicit labeling, all music rights, foreign-law eligibility and an explicit no-royalty permission clause require legal and human approval before any email is sent.',
    notes:
      'Passively verified on 2026-07-18 from the official submission, home, listening, contact and January 2026 acceptable-use pages. The station requests no more than three tracks, MP3/WAV/AAC only, a correctly formatted Artist Name – Song Title filename, completed ID3 metadata and clean versions where possible. The published terms grant broadcast permission and state that the station need not pay royalties, so the route is not eligible for automatic submission. No file was attached, no email was sent, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  ...run474SeedPlatforms
];
