import type { PlatformInput } from '../models/types.js';

export const run425SeedPlatforms: PlatformInput[] = [
  {
    name: 'Brum Radio Free Non-Local Specialist-Show Form and Email Submission Opportunity',
    websiteUrl: 'https://brumradio.com/',
    submissionUrl: 'https://brumradio.com/submissions/',
    sourceUrl: 'https://brumradio.com/submissions/',
    sourceType: 'automation_run_425_public_research',
    country:
      'United Kingdom / Birmingham independent online radio station; Birmingham and West Midlands artists are eligible for the main playlist, while music from elsewhere is accepted for specialist-show consideration; international eligibility is not explicitly stated',
    language: 'en',
    genres: [
      'independent-radio',
      'online-radio',
      'specialist-radio-shows',
      'non-local-artists-accepted',
      'electronic',
      'chill',
      'indie',
      'reggae',
      'soul',
      'world',
      'experimental',
      'one-track-only',
      'mp3-192kbps-or-higher',
      'wav',
      'radio-edit-preferred',
      'under-four-minutes-thirty-preferred',
      'no-explicit-lyrics',
      'no-spotify-or-youtube-links',
      'bandcamp-or-soundcloud-downloads-enabled',
      'direct-audio-upload-form',
      'authorized-submission-email-alternative',
      'no-visible-login-captcha-or-payment',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-one-track-upload-form-with-authorized-purpose-labelled-submission-email-alternative',
    feeRequired: false,
    feeAmount:
      'The official submission and contact pages publish a direct form and submission mailbox and do not state a submission fee or paid prerequisite.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Brum Radio restricts its main playlist to Birmingham and West Midlands artists but accepts music from elsewhere only for specialist shows. The form requires one directly uploaded MP3 at 192 kbps or higher or WAV file and a radio-friendly/no-explicit confirmation, rejects ordinary Spotify and YouTube links, and leaves maximum file size, international eligibility, rights, release-window and AI-origin rules unpublished. A human must select one suitable clean MarcsMusic track, choose either the form or authorized submission email, inspect the exact audio file and metadata, confirm specialist-show fit and international eligibility, verify rights and current AI policy, recheck the live form for protected controls, and submit manually.',
    notes:
      'Verified on 2026-07-17 from Brum Radio’s official Submit Music, Contact, A-List, Shows, Schedule, live-player and Music Team recruitment pages. The submission page accepts one MP3 at 192 kbps or higher or WAV file, prefers a radio edit under 4:30, rejects Spotify and YouTube streaming links, and allows Bandcamp or SoundCloud only when downloads are enabled. The form requests name, email, artist name, base postcode, track title, release date, a radio-friendly/no-explicit confirmation, one audio upload, an optional press-track link and notes. Brum Radio’s Contact page explicitly labels submissions@brumradio.com for music submissions, while studio@brumradio.com, connect@brumradio.com, hello@brumradio.com and help@brumradio.com were excluded as general, press, advertising/partnership or recruitment contacts. Current operation is supported by the 2026 live player, populated show directory and schedule, ongoing submission guidance and a recent Music Team recruitment page describing weekly submission review work. No form field, audio, link, email, login, CAPTCHA or payment was submitted.'
  }
];
