import type { PlatformInput } from '../models/types.js';
import { run465SeedPlatforms } from './run465PlatformSeeds.js';

export const run464SeedPlatforms: PlatformInput[] = [
  {
    name: 'OurTownRadio Independent Artist Email and Download-Link Airplay Route',
    websiteUrl: 'https://ourtownradio.com/',
    submissionUrl: 'https://ourtownradio.com/submit-music/',
    sourceUrl: 'https://ourtownradio.com/submit-music/',
    sourceType: 'automation_run_464_public_research',
    country:
      'United States (Pennsylvania) internet-radio station with worldwide-facing online listenership; international artist eligibility is not explicitly confirmed on the first-party submission page',
    language: 'en',
    genres: [
      'independent-music',
      'indie',
      'pop',
      'acoustic',
      'rock',
      'r-and-b',
      'hip-hop',
      'hard-rock',
      'screamo',
      'country',
      'folk',
      'punk',
      'experimental',
      'all-genres',
      'metadata-required',
      'download-link',
      'public-email',
      'optional-physical-media',
      'rights-confirmation',
      'free-first',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-business-email-route-accepting-download-or-streaming-links-for-independent-radio-airplay',
    feeRequired: false,
    feeAmount:
      'The first-party submission page publishes no submission fee and states that featured-artist consideration is free.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route is a legitimate first-party music mailbox with no published login, CAPTCHA or payment requirement, but a human must review the non-exclusive airplay and promotional-use grant, confirm ownership and cover-song rights, clarify international and AI-assisted-music eligibility, choose an appropriate MarcsMusic track, and explicitly authorize the final email or file-transfer action.',
    notes:
      'Verified on 2026-07-17 from OurTownRadio first-party submission, terms and current programming pages. The station accepts original independent music in almost all genres, prefers MP3 files with title/artist/album metadata, accepts one song or a full album, permits free download links through transfer services and also accepts Spotify or YouTube links. The official mailbox is MUSIC@OURTOWNRADIO.COM. Covers are prohibited unless the submitter has the rights. The submission page states that submitting grants rights for airplay and promotional use; the terms describe a non-exclusive, non-transferable right to host content for public airplay and advertising promotions. Current activity was evidenced by a July 11, 2026 weekly chart and published upcoming shows. No email was sent, no file was uploaded, no account or login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  ...run465SeedPlatforms
];
