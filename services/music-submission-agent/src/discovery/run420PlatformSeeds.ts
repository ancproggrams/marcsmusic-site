import type { PlatformInput } from '../models/types.js';
import { run421SeedPlatforms } from './run421PlatformSeeds.js';

export const run420SeedPlatforms: PlatformInput[] = [
  {
    name: 'CKXU 88.3 FM EP/LP Digital Music-Submission Form Opportunity',
    websiteUrl: 'https://ckxu.com/',
    submissionUrl: 'https://ckxu.com/submit-music/',
    sourceUrl: 'https://ckxu.com/submit-music/',
    sourceType: 'automation_run_420_public_research',
    country:
      'Canada / Lethbridge, Alberta campus-community radio; the form requests location but international artist eligibility is not explicitly guaranteed',
    language: 'en',
    genres: [
      'campus-community-radio',
      'independent-music',
      'ep-lp-only',
      'no-singles',
      'electronic',
      'house',
      'techno',
      'ambient',
      'experimental',
      'world',
      'afrobeat',
      'dancehall',
      'hip-hop',
      'indie',
      'digital-submission-form',
      'download-link-or-code',
      'mp3-only',
      'no-streaming-links',
      'physical-submission-alternative',
      'offensive-content-disclosure',
      'optional-local-artist-mailout-consent',
      'protected-music-department-contacts-not-decoded',
      'no-visible-payment-requirement',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-digital-music-submission-form-requiring-an-ep-or-lp-download-link-or-code-in-mp3-format',
    feeRequired: false,
    feeAmount:
      'The standard CKXU digital and physical music-submission workflow does not publish a fee. A separate Southern-Alberta local music mail-out section is dated 2023 and describes a per-release distribution fee; it is not the canonical airplay-submission route and was excluded.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CKXU accepts EPs and LPs but explicitly rejects singles, requires MP3 delivery through a downloadable link or code, rejects streaming links, asks for release metadata and offensive-content disclosure, and requests location plus representative-identity information. A human must choose an eligible release, avoid inferring or fabricating identity information, confirm whether those sensitive descriptors are optional, verify international eligibility, rights, release timing, bitrate, link access and the current AI-origin policy, leave the optional local-artist mail-out consent at No unless deliberately authorized, recheck the live form for CAPTCHA or protected controls, and submit manually.',
    notes:
      'Verified on 2026-07-17 from CKXU’s official Submit Music, Contact and On-Air pages. The standard route accepts physical and digital EP/LP submissions, rejects singles, accepts MP3 only, rejects WAV/MP4/FLAC and streaming links, and asks for a Dropbox, Bandcamp or equivalent download link or code. The form requests artist and release metadata, track list, offensive-language details, genre, similar artists, contact information and an optional local-artist-database opt-in. CKXU’s January 2026 schedule and June 2026 station posts verify current activity and include house, techno, electronic, ambient, experimental, world, Afrobeat, dancehall, hip-hop and indie programming. Music Department email links are first-party and purpose-labelled but Cloudflare-protected; no address was decoded, guessed or stored. No form field, link, file, identity detail, consent, login, CAPTCHA, payment or physical package was submitted.'
  },
  ...run421SeedPlatforms
];
