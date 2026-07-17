import type { PlatformInput } from '../models/types.js';

export const run465SeedPlatforms: PlatformInput[] = [
  {
    name: 'KDBR Dain Bramage Radio Worldwide Free Indie Upload Form',
    websiteUrl: 'https://dainbramageentertainment.com/',
    submissionUrl: 'https://dainbramageentertainment.com/kdbr-radio',
    sourceUrl: 'https://dainbramageentertainment.com/kdbr-radio',
    sourceType: 'automation_run_465_public_research',
    country:
      'United States (Soldotna, Alaska) internet-radio station explicitly inviting independent artists worldwide',
    language: 'en',
    genres: [
      'independent-music',
      'underground',
      'hip-hop',
      'rock',
      'electronic',
      'pop',
      'metal',
      'r-and-b',
      'indie',
      'lo-fi',
      'clean-radio-edit',
      'mp3',
      'wav',
      'private-streaming-link',
      'direct-upload',
      'artist-profile',
      'worldwide',
      'free-first',
      'captcha',
      'rights-confirmation',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-free-embedded-music-upload-form-with-streaming-link-option-for-radio-airplay-and-featured-artist-consideration',
    feeRequired: false,
    feeAmount:
      'The first-party KDBR page states that submission and airplay are completely free and that the station does not charge payola or label fees.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The authorized first-party form accepts direct MP3/WAV and artwork uploads or private SoundCloud/YouTube links, but it is protected by reCAPTCHA and is followed by a separate permission form. A human must inspect the permission terms, confirm clean broadcast-ready audio, ownership and contributor rights, verify AI-assisted-music eligibility, reconcile the published operating-hours discrepancy, and explicitly authorize any upload and final submission.',
    notes:
      'Verified on 2026-07-17 from KDBR/Dain Bramage first-party radio, featured-artist, home/contact and Caster.fm station pages. The route invites independent artists worldwide, requests Band/Artist Name, Email, Genres and Desired Link, permits track/artwork attachments, asks for clean broadcast-ready MP3/WAV files or private SoundCloud/YouTube links, and says accepted artists receive a short permission form while retaining ownership. The form is protected by reCAPTCHA. Contact@dainbramageentertainment.com is a first-party general business mailbox, not the published submission route. No form field was filled, no file was uploaded, no permission form was signed, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  }
];
