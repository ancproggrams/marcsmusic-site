import type { PlatformInput } from '../models/types.js';

export const run435SeedPlatforms: PlatformInput[] = [
  {
    name: 'WKNC 88.1 FM Official Digital Music Submission Form',
    websiteUrl: 'https://wknc.org/',
    submissionUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSf1Y8Hr65Df3yfa6_UbsSnhze2U336G_69xwvdXglgAu68B5g/viewform?usp=sf_link',
    sourceUrl: 'https://wknc.org/about/music/',
    sourceType: 'automation_run_435_public_research',
    country:
      'United States / Raleigh, North Carolina student-run NC State University FM and HD radio station; the form explicitly supports North Carolina and non-North-Carolina artists, but international eligibility is not separately stated',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-music',
      'electronic',
      'afterhours',
      'indie-rock',
      'hip-hop',
      'r-and-b',
      'heavy-metal',
      'jazz',
      'single-or-album',
      'dropbox-or-google-drive-link',
      'wav-preferred-mp3-accepted',
      'fcc-clean-preferred',
      'google-form',
      'recaptcha',
      'free-first',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-linked-google-form-with-shareable-dropbox-or-google-drive-audio-link-and-genre-routing',
    feeRequired: false,
    feeAmount:
      'WKNC publishes the digital music-submission form as its required airplay-consideration route and does not state a submission fee, account purchase or payment prerequisite.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The official Google Form displays reCAPTCHA and requires a shareable Dropbox or Google Drive audio link, genre selection, clean-content disclosure and editorial judgment. Google sign-in is offered only to save progress in the accessible form, not stated as a submission prerequisite. A human must select the correct WKNC format, verify link permissions and the submitted master, disclose FCC violations accurately, confirm international and AI-origin eligibility, review any live form changes, complete the human-verification control and submit manually.',
    notes:
      'Verified on 2026-07-17 from WKNC’s official music-submission page, current Summer 2026 staff page, active HD-1/HD-2 listening and playlist surfaces, and the live Google Form created inside North Carolina State University. WKNC stopped accepting emailed airplay submissions in January 2022 and directs artists exclusively to the form. The form requests email, artist name, North Carolina status, one of six music formats, single-versus-album selection, title, a shareable Dropbox or Google Drive link, FCC-violation disclosure and optional notes. WAV is preferred and MP3 is accepted; YouTube, SoundCloud and Spotify links are explicitly rejected because directors cannot download them. The current staff page lists wknc-afterhours@ncsu.edu for electronic-submission follow-up, but states that music itself must only be sent through the form. The address is first-party published, syntactically valid and domain-aligned; no deliverability probing was performed. No form field, link, account, login, CAPTCHA, payment or submission action was completed.'
  }
];
