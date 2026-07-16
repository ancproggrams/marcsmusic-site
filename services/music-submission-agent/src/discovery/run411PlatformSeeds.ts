import type { PlatformInput } from '../models/types.js';
import { run412SeedPlatforms } from './run412PlatformSeeds.js';

export const run411SeedPlatforms: PlatformInput[] = [
  {
    name: 'KWDC 93.5 Clean-MP3 Music Submission and Consent Route',
    websiteUrl: 'https://www.kwdc.fm/',
    submissionUrl: 'https://www.kwdc.fm/music-submissions',
    sourceUrl: 'https://www.kwdc.fm/music-submissions',
    sourceType: 'automation_run_411_public_research',
    country:
      'United States / Stockton, California college radio with worldwide online listening and international submission eligibility not explicitly stated',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-music',
      'unsigned-artists',
      'underground-music',
      'electronic',
      'dance',
      'hip-hop',
      'r-and-b',
      'soul',
      'rock',
      'latin',
      'cross-genre',
      'public-business-email',
      'authorized-digital-submission-route',
      'mp3-only',
      'clean-content-required',
      'signed-consent-required',
      'digital-signature-option',
      'capacity-gated',
      'international-eligibility-unconfirmed',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-business-email-with-clean-mp3-attachment-and-mandatory-signed-music-consent-form-or-manual-digital-signature',
    feeRequired: false,
    feeAmount:
      'KWDC publishes no submission fee, account login, CAPTCHA or mandatory payment for the email route. The signed consent form is mandatory. The optional digital-signature workflow must be inspected manually for any session, challenge, terms or authentication controls.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KWDC explicitly authorizes music submissions through kwdc@deltacollege.edu and requires clean, non-vulgar, non-discriminatory and non-explicit content, a signed music consent form or manually completed digital-signature workflow, the subject Music Submission, sender and artist details, song title, a short description, social or website links, and an MP3 stereo master at -3 dB. A human must review and sign the legal consent, inspect the digital-sign route without bypassing any protection, select one suitable clean MarcsMusic master, verify the exact MP3 and loudness requirements, confirm attachment limits, rights, international eligibility, release timing and AI-origin policy, and send manually. No auto-submit candidate is permitted.',
    notes:
      'Verified on 2026-07-16 from KWDC’s official Music Submissions, homepage, schedule, staff, community and programme pages. The submission page publishes kwdc@deltacollege.edu in plaintext, explicitly invites independent and unsigned-artist music, requires clean content, a completed consent form, an email using the Music Submission subject, artist and song information, a description and social or website links, and an MP3 stereo master at -3 dB. It also offers a digital-signature route that was not executed. Summer 2026 activity is supported by a current 24/7 schedule, current faculty and staff, live and online listening, The Underground Hour and current programme pages. The mailbox was verified by first-party plaintext publication, explicit submission purpose, valid syntax and exact deltacollege.edu institutional-domain alignment; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, form, consent, signature, audio, attachment, account, login, CAPTCHA or payment was submitted.'
  },
  ...run412SeedPlatforms
];
