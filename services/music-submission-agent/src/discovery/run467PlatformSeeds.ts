import type { PlatformInput } from '../models/types.js';

export const run467SeedPlatforms: PlatformInput[] = [
  {
    name: 'Discover YOU RADIO Free Rotation Evaluation Form',
    websiteUrl: 'https://discoveryouradio.com/real-radio',
    submissionUrl: 'https://discoveryouradio.com/artist-submissions',
    sourceUrl: 'https://discoveryouradio.com/artist-submissions',
    sourceType: 'automation_run_467_public_research',
    country:
      'United States online independent-music radio and promotion platform; international artist eligibility is not explicitly stated',
    language: 'en',
    genres: [
      'independent-music',
      'radio-airplay',
      'clean-radio-edit',
      'itunes-link',
      'artist-biography',
      'song-context',
      'official-form',
      'optional-mailing-list',
      'optional-paid-promotion',
      'free-first',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-rotation-evaluation-form-using-an-itunes-track-link',
    feeRequired: false,
    feeAmount:
      'The current first-party submission page states that all initial rotation evaluations are 100% free. Optional certificates of airplay and organic station-pitching services are separate paid services.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The public form requests identity/contact data, an iTunes track link, artist history and song context, and includes an optional mailing-list choice. A human must confirm clean/radio-friendly suitability, ownership and contributor rights, international and AI-assisted-music eligibility, the accuracy of all artist metadata, and the live form controls before final submission. Optional paid services and the separate sync-licensing route must remain excluded.',
    notes:
      'Passively verified on 2026-07-18 from Discover YOU RADIO first-party Artist Submissions, Real Radio, Shows, Privacy, Terms and Music Licensing surfaces. The current submission page says initial rotation evaluation is free, requires a clean/radio-friendly track and shows fields for name, artist name, song title, email, an optional mailing-list choice, an iTunes purchase link, biography/history and song inspiration, plus questions/comments. If accepted, the station says it purchases the song on iTunes and adds it to its request catalog. Current July 2026 live-show listings and the active request/scouting pages support recent activity. submit@discoveryouradio.com and admin@discoveryouradio.com are support contacts rather than authorized music-submission substitutes; uploads@discoveryouradio.com belongs to a separate sync-licensing workflow. No form field was filled, no link was submitted, no mailing-list consent was given, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  }
];
