import type { PlatformInput } from '../models/types.js';
import { run450SeedPlatforms } from './run450PlatformSeeds.js';

export const run429SeedPlatforms: PlatformInput[] = [
  {
    name: 'WOLF Radio UWG Public Music-Director Email Submission Route',
    websiteUrl: 'https://thewolfuwg.com/',
    submissionUrl: 'https://thewolfuwg.com/musicsubmissions/',
    sourceUrl: 'https://thewolfuwg.com/musicsubmissions/',
    sourceType: 'automation_run_429_public_research',
    country:
      'United States / Carrollton, Georgia student-managed University of West Georgia online college-radio station; the submission page welcomes local and unsigned artists, while the official university describes a global audience, but international submission eligibility is not explicitly published',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-music',
      'unsigned-artists',
      'local-artist-priority',
      'eclectic',
      'electronic',
      'dubstep',
      'riddim',
      'indie',
      'folk',
      'pop',
      'rock',
      'lofi',
      'alternative',
      'hip-hop',
      'radio-edit-requested',
      'soundcloud-or-listenable-link',
      'public-music-director-email',
      'free-first',
      'no-target-platform-login-captcha-or-payment',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-music-director-email-with-soundcloud-or-other-listenable-music-link-and-radio-edit-request',
    feeRequired: false,
    feeAmount:
      'The official WOLF Radio music-submission page publishes a direct music-director email route and does not state a submission fee, account purchase or paid prerequisite.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The authorized route is a public editorial email to the WOLF Radio music director. The station requests radio edits and accepts a SoundCloud page or another outlet that lets staff hear the music, but it does not publish a subject-line format, track-count limit, attachment policy, preferred downloadable-link format, metadata checklist, release-recency rule, rights declaration, explicit-content standard beyond the radio-edit request, international eligibility or current AI-assisted and AI-generated music policy. A human must choose a suitable MarcsMusic track, confirm international eligibility, prepare a concise personalized pitch and stable listening or download link, verify radio-edit and rights suitability, avoid unsolicited attachments unless expressly confirmed, and send manually.',
    notes:
      'Verified on 2026-07-17 from WOLF Radio’s official music-submission page, current homepage, about page and 2026 WOLFstock coverage, plus current University of West Georgia pages. The submission page instructs artists to email their music, SoundCloud page or another outlet that permits listening to thewolfmusicdirector@gmail.com and asks for radio edits. Current activity is supported by the live-listening surface, recent 2026 station content, WOLFstock 2026, and the university’s June 9, 2026 description of WOLF Radio and WOLF Sports Network as active 24/7 college-radio stations. The music-director address is published in plaintext on the first-party station page and is syntactically and contextually aligned, but it uses Gmail rather than the university domain. No email, attachment, account, login, CAPTCHA, payment or submission action was completed.'
  },
  ...run450SeedPlatforms
];
