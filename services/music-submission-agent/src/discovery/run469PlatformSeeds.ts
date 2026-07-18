import type { PlatformInput } from '../models/types.js';
import { run470SeedPlatforms } from './run470PlatformSeeds.js';

export const run469SeedPlatforms: PlatformInput[] = [
  {
    name: 'Airhug Radio Independent Artist Submission Form',
    websiteUrl: 'https://airhugradio.com/',
    submissionUrl: 'https://airhugradio.com/music-submission/',
    sourceUrl: 'https://airhugradio.com/music-submission/',
    sourceType: 'automation_run_469_public_research',
    country:
      'Global online independent-music radio; operator location is not explicitly published and the first-party site states a worldwide artist focus',
    language: 'en',
    genres: [
      'electronic',
      'world',
      'pop',
      'rock',
      'hip-hop',
      'r-and-b',
      'country',
      'jazz',
      'blues',
      'folk',
      'classical',
      'latin',
      'independent-music',
      'radio-airplay',
      'direct-upload',
      'lyrics-pdf',
      'pro-registration',
      'soundexchange-registration',
      'digital-signature',
      'rights-declaration',
      'hard-ai-prohibition',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-four-step-independent-artist-submission-form-with-direct-audio-and-lyrics-uploads',
    feeRequired: false,
    feeAmount:
      'No submission fee or payment step is published on the first-party music-submission form.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route requires PRO and SoundExchange eligibility, legal identity and royalty data, direct audio and lyrics uploads, explicit-content disclosure, promotional-media consent, broadcast authorization, a digital signature and agreement to linked Live365 terms. The platform strictly prohibits AI in submissions, so a human must confirm that the selected MarcsMusic track contains no prohibited AI-generated or AI-assisted element before proceeding. Hidden live-form anti-spam controls, file limits, international registration compatibility and the linked legal terms also require manual review.',
    notes:
      'Passively verified on 2026-07-18 from Airhug Radio first-party home, about and music-submission pages plus the active Live365 station page. The public four-step form accepts independent artists, asks for English responses, requires a PRO and SoundExchange registration, and lists Pop, Rock, Hip-Hop, R&B, Electronic, Country, Jazz, Blues, Folk, Classical, Latin, World and Other. It requests artist and legal names, email, country, label status, song title, optional ISRC, PRO details, SoundExchange status and artist ID, genre, BPM, direct song and lyrics uploads, explicit-language and clean-version information, a biography, optional interview interest, photo and cover-art promotional consent, broadcast permission, rights confirmation, a digital signature and date/time. Up to ten files are shown; WAV is preferred and lyrics are requested as PDF. The page explicitly states that AI use is strictly prohibited. Live365 displayed current now-playing and recent-track data during verification. No public business email was identified as an authorized submission route. No form field was filled, no file was uploaded, no agreement was accepted, no signature was entered, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  ...run470SeedPlatforms
];
