import type { PlatformInput } from '../models/types.js';
import { run405SeedPlatforms } from './run405PlatformSeeds.js';

export const run404SeedPlatforms: PlatformInput[] = [
  {
    name: 'KSPC 88.7 FM Album and EP Submission Route',
    websiteUrl: 'https://kspc.org/',
    submissionUrl: 'https://kspc.org/contact/music-submissions/',
    sourceUrl: 'https://kspc.org/contact/music-submissions/',
    sourceType: 'automation_run_404_public_research',
    country: 'United States / Claremont, California college and community radio with worldwide online streaming',
    language: 'en',
    genres: [
      'college-radio',
      'community-radio',
      'freeform-radio',
      'independent-music',
      'all-genres',
      'electronic',
      'hip-hop',
      'reggae',
      'world-music',
      'experimental',
      'cross-genre',
      'album-ep-only',
      'protected-first-party-email',
      'authorized-digital-submission-route',
      'authorized-physical-submission-alternative',
      'ai-provenance-restricted',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-protected-email-album-ep-download-or-physical-delivery-route',
    feeRequired: false,
    feeAmount:
      'KSPC states that it is noncommercial, does not accept payment for airplay and publishes no submission fee, account, login or mandatory-payment requirement. Digital delivery is the free-first route. Optional physical-media production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KSPC explicitly welcomes all genres but accepts only albums and EPs, not singles or demos. Its official page authorizes digital delivery by protected first-party email using attached files or a downloadable cloud-storage link, and also authorizes CDs or records by mail. Streaming-only YouTube, SoundCloud, Spotify and iTunes routes are not accepted unless the supplied site provides a download. Work substantially generated through AI is ineligible. The email destination is Cloudflare-protected and was not decoded, guessed or stored. A human must open the official page, verify the live destination, confirm international eligibility plus formats, file-size, metadata and explicit-content requirements, and submit only one eligible non-single, non-demo album or EP whose provenance complies with the AI restriction.',
    notes:
      'Verified on 2026-07-16 from KSPC’s official Music Submissions, Contact and homepage pages plus its current first-party-linked Spinitron surface. The submission page explicitly welcomes artists from all genres, authorizes digital files or downloadable cloud links and permits an alternative CD or record, while excluding singles, demos, cassettes, non-downloadable streaming links, Spotify/iTunes links, pay-for-play and substantially AI-generated work. Two official email actions are published for submission and follow-up, but Cloudflare masks the destinations in passive retrieval; no address was decoded, inferred, guessed or copied from a third-party source. Current operation was supported by KSPC’s live site, a March 30, 2026 first-party article and Spinitron programming dated July 16, 2026. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, file, cloud link, physical package, form field, login, CAPTCHA, consent or payment was submitted.'
  },
  ...run405SeedPlatforms
];
