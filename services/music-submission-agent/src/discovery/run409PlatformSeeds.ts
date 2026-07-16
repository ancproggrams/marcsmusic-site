import type { PlatformInput } from '../models/types.js';
import { run410SeedPlatforms } from './run410PlatformSeeds.js';

export const run409SeedPlatforms: PlatformInput[] = [
  {
    name: 'Wild Dogs Radio Global Free Single-Song Submission Route',
    websiteUrl: 'https://wilddogsradio.com/',
    submissionUrl: 'https://wilddogsradio.com/music-submissions/',
    sourceUrl: 'https://wilddogsradio.com/music-submissions/',
    sourceType: 'automation_run_409_public_research',
    country: 'United States-based internet radio serving and accepting artists from all corners of the world',
    language: 'en',
    genres: [
      'internet-radio',
      'independent-music',
      'all-genres',
      'electronic',
      'bass-music',
      'hip-hop',
      'reggae',
      'world-music',
      'experimental',
      'cross-genre',
      'public-business-email',
      'authorized-digital-submission-route',
      'single-song-submission',
      'audio-attachment-required',
      'artwork-required',
      'isrc-required',
      'international-artists-explicitly-supported',
      'capacity-gated',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-business-email-with-single-mp3-or-wav-attachment-song-art-and-release-metadata',
    feeRequired: false,
    feeAmount:
      'Wild Dogs Radio explicitly states that single-song submissions are always free. No account login, CAPTCHA or mandatory payment is published. Donations, merchandise and promotional services are separate adjacent routes and are not submission requirements.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Wild Dogs Radio explicitly authorizes one-song submissions through office@wilddogsradio.com and requires an MP3 or WAV music file, song artwork, artist or band name, song title, single or album/EP name, release year and ISRC. A human must select one suitable MarcsMusic track, confirm ownership and the correct ISRC, verify attachment size and mailbox limits because none are published, confirm the current AI-assisted or AI-generated music policy, and ensure the selected file and artwork contain no unsupported or misleading metadata. The station says a response may take up to 90 days because of submission volume and accepted tracks receive 30 days of periodical airplay. Do not automate email delivery, send a catalogue, use the separate social-request route as a substitute or treat donations, merchandise or paid promotion as submission prerequisites.',
    notes:
      'Verified on 2026-07-16 from Wild Dogs Radio’s official Music Submissions, homepage, schedule and privacy-policy pages. The submission page states that submissions are always free, accepts all genres and directs single-song submissions to office@wilddogsradio.com with an MP3 or WAV file, song art, artist name, title, release container, release year and ISRC. The homepage states that the station assists artists from all corners of the world, exposes live-listening functions and displays recently aired music. The current weekly schedule contains daily programming including world-indie, alternative, metal, funk, underground and request shows. The mailbox was verified by first-party plaintext publication, explicit music-submission purpose, valid syntax and exact wilddogsradio.com domain alignment; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, audio, artwork, attachment, metadata, social request, form field, login, CAPTCHA, consent, donation or payment was submitted.'
  },
  ...run410SeedPlatforms
];
