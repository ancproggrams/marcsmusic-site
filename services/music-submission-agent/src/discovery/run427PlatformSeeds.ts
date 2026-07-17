import type { PlatformInput } from '../models/types.js';
import { run428SeedPlatforms } from './run428PlatformSeeds.js';

export const run427SeedPlatforms: PlatformInput[] = [
  {
    name: 'Camaradio 101.3 FM One-Song Public Upload-or-Link Submission Form',
    websiteUrl: 'https://camaradio.org/',
    submissionUrl: 'https://camaradio.org/submissions/',
    sourceUrl: 'https://camaradio.org/submissions/',
    sourceType: 'automation_run_427_public_research',
    country:
      'United States / Camarillo and Ventura County, California nonprofit non-commercial FCC-licensed low-power FM and online community station; the form accepts a Ventura County yes/no answer and city, indicating non-local submissions can be represented, but international eligibility is not explicitly published',
    language: 'en',
    genres: [
      'community-radio',
      'non-commercial-radio',
      'low-power-fm',
      'independent-music',
      'one-song-only',
      'wav-or-mp3',
      '44.1khz-or-48khz',
      '16-bit-stereo',
      'under-10mb-upload',
      'download-link-alternative',
      'rights-affirmation',
      'broadcast-authorization',
      'public-upload-form',
      'math-human-verification',
      'captcha',
      'no-visible-login-or-payment',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-one-song-public-form-with-direct-wav-or-mp3-upload-or-download-link-and-rights-authorization',
    feeRequired: false,
    feeAmount:
      'The official submission page publishes a direct music-consideration form and does not state a submission fee, account requirement or paid prerequisite.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The form contains a dynamic arithmetic human-verification challenge, a rights affirmation and authorization to broadcast, and an optional audio upload. It limits consideration to one song and requires a WAV or MP3 in 44.1 or 48 kHz, 16-bit stereo, with direct uploads under 10 MB or a downloadable link for larger files. International eligibility, explicit-content rules, release-window requirements and the current AI-assisted or AI-generated music policy are not published. A human must select one suitable MarcsMusic track, verify the exact master, metadata and rights, choose upload or link delivery, answer the locality question accurately, complete the human-verification challenge personally, recheck the live form and submit manually.',
    notes:
      'Verified on 2026-07-17 from Camaradio’s official submission, about, schedule, home and news pages. The submission page requests one song only, accepts a download link or direct file upload, requires WAV or MP3 audio at 44.1 or 48 kHz and 16-bit stereo, and states that direct uploads must be under 10 MB. Visible fields include submitter name, artist or band name, email, Ventura County yes/no, city, song title, song release date, optional album title and release date, music-file link or upload, and an arithmetic human-verification field. Submitters affirm they hold the necessary rights and authorize Camaradio to air the track if selected. Current activity is supported by a populated weekly schedule, active listen surface, 2026 news and events, recently played content and the station’s 2026 nonprofit/FCC-licensed community-radio descriptions. No form field, audio file, link, email, login, CAPTCHA answer or payment was submitted.'
  },
  ...run428SeedPlatforms
];
