import type { PlatformInput } from '../models/types.js';
import { run417SeedPlatforms } from './run417PlatformSeeds.js';

export const run416SeedPlatforms: PlatformInput[] = [
  {
    name: 'KAZI 88.7 FM UnTapped One-Song Digital Submission Opportunity',
    websiteUrl: 'https://kazifm.org/',
    submissionUrl: 'https://kazifm.org/untapped-music-submissions/',
    sourceUrl: 'https://kazifm.org/untapped-music-submissions/',
    sourceType: 'automation_run_416_public_research',
    country:
      'United States / Austin, Texas community radio with international artist eligibility not explicitly stated',
    language: 'en',
    genres: [
      'community-radio',
      'independent-radio',
      'emerging-artists',
      'one-song-only',
      'hip-hop',
      'r-and-b',
      'soul',
      'reggae',
      'blues',
      'jazz',
      'gospel',
      'zydeco',
      'cross-genre',
      'authorized-digital-submission-route',
      'email-submission',
      'public-business-email',
      'streaming-link-required',
      'downloadable-audio-required',
      'mp3-or-wav',
      'radio-edited',
      'free-first',
      'international-eligibility-unconfirmed',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-untapped-show-email-with-one-radio-edited-song-streaming-link-and-downloadable-mp3-or-wav',
    feeRequired: false,
    feeAmount:
      'The official UnTapped page publishes no submission fee, account login, CAPTCHA or mandatory payment. The route is a direct email workflow requiring one prepared radio-edited song.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KAZI explicitly accepts one new, quality radio-edited song at music@kazifm.org and requests a streaming link plus downloadable MP3 or WAV audio. A human must select exactly one suitable track, confirm whether both delivery elements are mandatory, resolve the technically ambiguous published WAV wording, verify the download permissions and master, and confirm international eligibility, explicit-content, release-window, rights and AI-origin policies before sending manually. Do not substitute the general contact form, info@kazifm.org, volunteer, donation, underwriting, social or listener-facing routes.',
    notes:
      'Verified on 2026-07-17 from KAZI 88.7 FM’s official UnTapped Music Submissions, homepage, About, Shows and 2026 programme pages. The submission page requests new radio-edited music, one song only, a streaming link, downloadable MP3 or WAV audio, sender and artist names, website or social handle, music format and email address. It publishes music@kazifm.org and says KAZI will respond within five business days. The official homepage exposed a live player with current now-on-air and upcoming programmes, and KAZI describes programming spanning R&B, soul, hip-hop, jazz, gospel, blues, reggae and zydeco. No dedicated music form, CAPTCHA, login or payment requirement was identified. No email, audio, link, attachment, form field, account or payment was submitted.'
  },
  ...run417SeedPlatforms
];
