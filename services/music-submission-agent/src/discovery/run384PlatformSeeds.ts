import type { PlatformInput } from '../models/types.js';

export const run384SeedPlatforms: PlatformInput[] = [
  {
    name: 'Insanity Radio 103.2FM Head of Music Exposure Inquiry Route',
    websiteUrl: 'https://insanityradio.com/',
    submissionUrl: 'https://insanityradio.com/about/board/',
    sourceUrl: 'https://insanityradio.com/about/board/',
    sourceType: 'automation_run_384_public_research',
    country: 'United Kingdom / Egham, Surrey student and community radio',
    language: 'en',
    genres: [
      'student-radio',
      'community-radio',
      'new-music',
      'up-and-coming-artists',
      'electronic',
      'alternative',
      'hip-hop',
      'bass',
      'playlist-consideration',
      'head-of-music',
      'manual-review'
    ],
    submissionMethod: 'official-public-head-of-music-exposure-pre-submission-inquiry-email',
    feeRequired: false,
    feeAmount: 'No submission or inquiry fee is stated on the official Production Board page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Insanity Radio publicly invites local or up-and-coming artists seeking exposure to contact its Head of Music, but it does not publish authorization to send audio immediately or state attachment-versus-link rules, formats, file sizes, metadata, release windows, international eligibility, clean or explicit-content requirements, AI-origin policy or response expectations. A human must confirm that Eoin Moffatt or the current role holder still manages the mailbox, send only an asset-free process inquiry, wait for explicit delivery instructions, permission-check the selected release and avoid duplicate outreach to the named-recipient address.',
    notes:
      'Verified on 2026-07-15 from Insanity Radio’s official homepage, Production Board, playlist, schedule and player pages. The Production Board publishes music@insanityradio for the Head of Music and explicitly instructs readers to append .com to all @insanityradio contacts, yielding music@insanityradio.com without guessing. The same page identifies Eoin Moffatt as Head of Music and invites local or up-and-coming artists seeking exposure to make contact. The role mailbox is retained as the canonical route; the named-recipient mailbox, general contact, other board contacts and postal address are excluded. The site displayed an operational ON AIR state and says its Music Team meets weekly to compile the playlist. No email, form field, file, link, login, CAPTCHA, consent or payment was entered or submitted.'
  }
];
