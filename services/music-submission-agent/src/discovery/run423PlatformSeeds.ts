import type { PlatformInput } from '../models/types.js';

export const run423SeedPlatforms: PlatformInput[] = [
  {
    name: 'KCR College Radio Free FCC-Clean Digital Email Submission Opportunity',
    websiteUrl: 'https://kcr.sdsu.edu/',
    submissionUrl: 'mailto:kcr@sdsu.edu',
    sourceUrl: 'https://kcr.sdsu.edu/contact/music-submissions/',
    sourceType: 'automation_run_423_public_research',
    country:
      'United States / San Diego, California student-run internet and campus radio station; all musicians are encouraged to submit, with special interest in San Diego artists',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-artists',
      'emerging-artists',
      'freeform-and-eclectic',
      'electronic',
      'alternative',
      'indie',
      'trip-hop',
      'dance',
      'digital-email-submission',
      'mp3-only',
      'fcc-clean-only',
      'artist-title-filename-format',
      'automated-playlist-and-dj-library',
      'no-status-calls',
      'no-visible-login-captcha-or-payment',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-music-submission-email-with-fcc-clean-mp3-named-artist-dash-song-title',
    feeRequired: false,
    feeAmount:
      'The official music-submission page publishes a direct institutional email route and does not state a submission fee or paid prerequisite.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KCR explicitly authorizes digital music submissions to kcr@sdsu.edu and requires FCC-clean MP3 files named Artist – Song Title. A human must select one suitable radio-ready track, verify that the exact master is clean, inspect MP3 encoding, filename and metadata, confirm attachment-size and track-count limits, determine whether a download link is acceptable instead of an attachment, verify international and non-local eligibility, rights and sample clearance, release timing and the current AI-assisted or AI-generated music policy, avoid status calls or repetitive follow-up, and send manually.',
    notes:
      'Verified on 2026-07-17 from KCR College Radio’s official Music Submissions, Contact, Home and current blog pages. The submission page states that all musicians are encouraged to submit, accepts digital submissions only at kcr@sdsu.edu, requires FCC-clean MP3 files named “Artist – Song Title,” and places accepted tracks in the automated playlist and DJ music library. The current Contact page lists 2025–26 management and current Music Directors at kcr.music@sdsu.edu; that role mailbox and the promotions mailbox were excluded from music delivery because the dedicated submission page directs artists to kcr@sdsu.edu. Current activity is supported by the live-listening interface and multiple official posts dated July 7, 2026. No email, MP3, attachment, metadata, form field, login, CAPTCHA, payment or follow-up was submitted.'
  }
];
