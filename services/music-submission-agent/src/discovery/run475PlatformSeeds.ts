import type { PlatformInput } from '../models/types.js';
import { run476SeedPlatforms } from './run476PlatformSeeds.js';

export const run475SeedPlatforms: PlatformInput[] = [
  {
    name: 'The Relay Station Ambient Music Submission',
    websiteUrl: 'https://stolace.com/relay-station/',
    submissionUrl: 'https://stolace.com/relay-station/artists/submit-music/',
    sourceUrl: 'https://stolace.com/relay-station/artists/submit-music/',
    sourceType: 'automation_run_475_public_research',
    country:
      'United States / global syndicated programme; the official route explicitly accepts independent and signed ambient artists from around the globe and asks for the artist country.',
    language: 'en',
    genres: [
      'ambient',
      'atmospheric',
      'neoclassical',
      'instrumental',
      'worldwide',
      'bandcamp-code',
      'download-link',
      'metadata-required',
      'content-id-clearance',
      'broad-promotional-consent',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public form using unused Bandcamp codes or non-expiring account-free direct-download links for high-quality metadata-complete MP3 files',
    feeRequired: false,
    feeAmount: 'No submission fee, checkout or mandatory payment is published for the official artist route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route requires strict ambient/neoclassical fit, rights and Content ID clearance, metadata-complete downloadable files, and free-and-clear permission covering syndicated programming, archives, monetized platforms, promotional materials, advertisements and other Stolace Productions content. Consent scope, rights, AI eligibility, link safety, optional mailing-list consent, hidden controls and final submission require human and legal approval.',
    notes:
      'Passively verified on 2026-07-18 from The Relay Station official artist-submission, artist-information, programme and episode pages. The programme accepts music from around the globe but generally rejects prominent drums, vocals, electronica, techno, house, noise, solo piano and deeply experimental work. It prefers unused Bandcamp codes or non-expiring account-free download links, prohibits Spotify links, prefers 320 kbps or VBR MP3s with complete metadata and requires automated copyright-protection or Content ID conflicts to be disabled or cleared. The latest visible episode was broadcast May 31, 2026, with weekly May 2026 episodes in the archive. No form field was filled, no code or link was submitted, no mailing-list consent was selected, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  {
    name: 'rBeatz Global Radio Free Music Submission',
    websiteUrl: 'https://rbeatz.com/',
    submissionUrl: 'https://rbeatz.com/music-submission/',
    sourceUrl: 'https://rbeatz.com/music-submission/',
    sourceType: 'automation_run_475_public_research',
    country:
      'United States / global network; the official form includes a worldwide country selector and routes music across multiple global and genre stations.',
    language: 'en',
    genres: [
      'hip-hop',
      'r-and-b',
      'electronic',
      'house',
      'global',
      'pop',
      'rock',
      'gospel',
      'single-or-album',
      'direct-audio-upload',
      'ai-disclosure',
      'digital-signature',
      'durable-license',
      'manual-review'
    ],
    submissionMethod:
      'official first-party four-step public form requiring artist/contact details, release metadata, station selection, direct audio upload, AI-origin disclosure and a digital signature',
    feeRequired: false,
    feeAmount: 'The official submission route states that single or album consideration is free and that airplay is not guaranteed.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The form requires a direct audio upload and signature accepting a Durable Licensing Agreement that grants a transferable, sublicensable, royalty-free, perpetual or maximum-term-plus-twenty-years, irrevocable and fully paid universal license including hosting, streaming, synchronization, advertising, modification, derivatives, distribution and persona use. Legal terms, indemnity, AI disclosure, rights, upload constraints, optional newsletter consent, hidden controls and final submission require explicit human and legal approval.',
    notes:
      'Passively verified on 2026-07-18 from the official submission, live-station, network and contact pages. The form accepts a single or album, requests contact and address data, social links, track/album/genre/label/ISRC information, AI-generation status, one of several rBeatz network stations, an audio upload and a signature. rBeatz Radio and its wider network publish active 24/7 global streams and a 2026 copyright notice. No file was selected or uploaded, no agreement was accepted or signed, no newsletter consent was given, no form field was filled, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  {
    name: 'PDX Radio Independent Hip-Hop and R&B Submission',
    websiteUrl: 'https://www.getpdxradio.com/',
    submissionUrl: 'https://www.getpdxradio.com/song-submission.html',
    sourceUrl: 'https://www.getpdxradio.com/song-submission.html',
    sourceType: 'automation_run_475_public_research',
    country:
      'United States (Portland, Oregon) / global online radio; the official station streams worldwide and its policy explicitly accepts international submissions.',
    language: 'en',
    genres: [
      'independent-hip-hop',
      'r-and-b',
      'soul',
      'related-subgenres',
      'worldwide',
      'official-form',
      'metadata-required',
      'rights-verification',
      'strict-ai-prohibition',
      'no-pay-to-play',
      'manual-review'
    ],
    submissionMethod:
      'official first-party song-submission page with an embedded intake form for final-master metadata, rights verification and possible free rotation consideration',
    feeRequired: false,
    feeAmount: 'PDX Radio expressly states that it does not charge submission, subscription or membership fees and does not allow pay-to-play.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The embedded form did not expose its complete live fields during passive retrieval. A human must inspect identity/contact verification, final-master and metadata fields, rights and sample/feature clearances, explicit-content handling, PRO/SoundExchange relevance, strict AI-generated-music exclusion, any permitted AI-assisted disclosure, hidden anti-spam or upload controls, the non-exclusive revocable promotional license and final submission.',
    notes:
      'Passively verified on 2026-07-18 from PDX Radio official song-submission, content-policy, about and New Music Monday pages. The route is free, accepts independent Hip-Hop, R&B and related genres worldwide, requires an adult authorized submitter, final master, accurate artist/title/featured-artist and ISRC or album/label metadata, and grants a non-exclusive revocable broadcast and promotional license if selected. The FAQ states that AI-generated music is not accepted and submissions are not used for AI training. info@getpdxradio.com is a first-party published general contact, not a substitute submission route. The separate livestream-only Nero route was excluded. No form field was filled, no identity data or track was submitted, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  ...run476SeedPlatforms
];
