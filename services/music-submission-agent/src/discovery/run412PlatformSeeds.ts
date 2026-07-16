import type { PlatformInput } from '../models/types.js';

export const run412SeedPlatforms: PlatformInput[] = [
  {
    name: 'Camaradio 101.3 One-Song Download-Link or Upload Submission Form',
    websiteUrl: 'https://camaradio.org/',
    submissionUrl: 'https://camaradio.org/submissions/',
    sourceUrl: 'https://camaradio.org/submissions/',
    sourceType: 'automation_run_412_public_research',
    country:
      'United States / Camarillo and Ventura County, California nonprofit community radio with international submission eligibility not explicitly stated',
    language: 'en',
    genres: [
      'community-radio',
      'nonprofit-radio',
      'independent-music',
      'single-song-submission',
      'electronic',
      'dance',
      'reggae',
      'world-music',
      'indie',
      'rock',
      'jazz',
      'blues',
      'cross-genre',
      'authorized-digital-submission-route',
      'dedicated-music-submission-form',
      'download-link-or-file-upload',
      'wav-or-mp3',
      'sixteen-bit-stereo',
      'captcha-protected',
      'rights-affirmation-required',
      'international-eligibility-unconfirmed',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-dedicated-music-submission-form-with-one-downloadable-link-or-wav-mp3-upload-and-human-arithmetic-captcha',
    feeRequired: false,
    feeAmount:
      'Camaradio publishes no submission fee, account login or mandatory payment for the dedicated music form. The form contains a changing arithmetic human-verification challenge that must be completed manually and must not be automated or bypassed.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Camaradio explicitly authorizes one-song airplay submissions through its dedicated first-party form. The form requires artist and contact details, local-area status, city, song and release data, either a downloadable file link or WAV/MP3 upload, a rights and broadcast authorization affirmation, and a changing arithmetic CAPTCHA. Audio must be 44.1 or 48 kHz, 16-bit stereo and under 10 MB for direct upload. A human must select one suitable MarcsMusic track, confirm ownership and rights, verify the exact file or permissioned download link, confirm international eligibility, explicit-content and AI-origin rules, complete the CAPTCHA personally, and submit manually. No automated form completion or CAPTCHA solving is permitted.',
    notes:
      'Verified on 2026-07-16 from Camaradio’s official Music Submissions, homepage, About, Schedule, News and Events, Contact and Support pages. The submission page expressly requests one song, accepts a downloadable link or file upload, specifies WAV or MP3 at 44.1 or 48 kHz and 16-bit stereo with a direct-upload limit under 10 MB, requires the submitter to affirm necessary rights and authorize possible airplay, and displays a changing arithmetic human-verification question. The form asks whether the artist is based in Ventura County and permits a No response, but does not explicitly confirm international eligibility. Current operation is supported by a populated weekly schedule, recently played and live-listening surfaces, 2026 station content and events including a July 11, 2026 fundraiser, and current nonprofit station information. No dedicated submission email is published. hello@camaradio.org is a first-party sponsorship contact and was verified only as an adjacent business mailbox, not used as a music-submission route. No form field, CAPTCHA response, audio, link, account, login or payment was entered or submitted.'
  }
];
