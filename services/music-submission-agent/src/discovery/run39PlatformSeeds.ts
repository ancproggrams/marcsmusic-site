import type { PlatformInput } from '../models/types.js';

export const run39SeedPlatforms: PlatformInput[] = [
  {
    name: 'KALX 90.7FM Berkeley Music Submissions',
    websiteUrl: 'https://kalx.berkeley.edu/',
    submissionUrl: 'https://kalx.berkeley.edu/contact/',
    sourceUrl: 'https://kalx.berkeley.edu/contact/',
    sourceType: 'automation_run_39_public_research',
    country: 'United States / Berkeley freeform college and community radio',
    language: 'en',
    genres: [
      'electronic',
      'reggae',
      'dub',
      'world',
      'bass-music',
      'hip-hop',
      'indie',
      'freeform-radio',
      'college-radio'
    ],
    submissionMethod: 'official-public-music-director-route-physical-cd-or-lp-only',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KALX publishes an official Music Directors route, but it explicitly requires professionally pressed physical CDs or LPs and rejects downloads, file transfers, Bandcamp, Spotify, YouTube, CD-Rs and other digital submissions. Owner approval and physical-mail preparation are required.',
    notes:
      'Official contact page lists music@kalx.berkeley.edu and the KALX mailing address for airplay submissions. The station homepage shows active current playlists, schedule and 2026 site activity. No email, upload, form submission, protected-contact decoding or physical mail was attempted.'
  },
  {
    name: 'KEXP Rotation Consideration',
    websiteUrl: 'https://kexp.org/',
    submissionUrl: 'https://kexp.org/contact/',
    sourceUrl: 'https://kexp.org/contact/',
    sourceType: 'automation_run_39_public_research',
    country: 'United States / Seattle and Bay Area public radio new-music discovery',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'reggae',
      'dub',
      'world',
      'hip-hop',
      'indie',
      'alternative',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-music-director-email-route-for-rotation-consideration',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KEXP provides an official Music Director and Music Department email route for rotation consideration, but the pitch still requires human curation, track selection, clean-edit review, rights verification, metadata, download links and tone/context approval before any outbound message.',
    notes:
      'Official KEXP contact page lists md@kexp.org for music rotation consideration and shows separate business/support/contact routes. KEXP homepage shows active July 2026 events, sessions and new-music content. No email or form submission was attempted.'
  },
  {
    name: 'Monstercat Demo Submission',
    websiteUrl: 'https://www.monstercat.com/',
    submissionUrl: 'https://www.monstercat.com/contact',
    sourceUrl: 'https://www.monstercat.com/contact',
    sourceType: 'automation_run_39_public_research',
    country: 'Canada / global electronic music label and community',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'dubstep',
      'bass-music',
      'drum-and-bass',
      'future-bass',
      'house',
      'melodic-electronic',
      'gaming-music'
    ],
    submissionMethod: 'official-public-demo-links-to-labelradar-for-uncaged-instinct-and-silk',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Monstercat routes demos through external LabelRadar demo links for Uncaged, Instinct and Silk. This requires manual owner approval because it involves an external submission system, potential account/login flow, originality review, rights ownership, A&R fit and label-specific genre targeting.',
    notes:
      'Official Monstercat contact page says every demo is listened to and links to Uncaged, Instinct and Silk demo submission routes. Official site shows current releases as of June 2026. No LabelRadar account, upload, form submission or protected contact decoding was attempted.'
  },
  {
    name: 'Spinnin Records Talent Pool',
    websiteUrl: 'https://spinninrecords.com/',
    submissionUrl: 'https://spinninrecords.com/talentpool/',
    sourceUrl: 'https://spinninrecords.com/talentpool/',
    sourceType: 'automation_run_39_public_research',
    country: 'Netherlands / global dance label demo community',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'house',
      'edm',
      'festival',
      'bass-music',
      'remix',
      'producer-community',
      'demo-submission'
    ],
    submissionMethod: 'official-public-talent-pool-demo-upload-route-requiring-login',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Spinnin Records Talent Pool is an official demo-upload route, but the page requires login before submitting a demo and uses community ranking/listing mechanics. Manual review is required for account access, terms, track metadata, rights ownership, mix/master quality and suitability for the Talent Pool.',
    notes:
      'Official Talent Pool page says users must create an account or log in to submit a demo and shows active popular/latest additions and releases. No login, account creation, upload, voting, sharing or form submission was attempted.'
  },
  {
    name: 'Armada Music Demo Drop',
    websiteUrl: 'https://www.armadamusic.com/',
    submissionUrl: 'https://www.armadamusic.com/demo-drop',
    sourceUrl: 'https://www.armadamusic.com/',
    sourceType: 'automation_run_39_public_research',
    country: 'Netherlands / global electronic dance music label group',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'edm',
      'trance',
      'progressive-house',
      'deep-house',
      'tech-house',
      'techno',
      'demo-submission'
    ],
    submissionMethod: 'official-public-demo-drop-route-dynamic-manual-review',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Armada Music publishes a Demo drop route in its official navigation, but the complete static submission workflow was not safely visible in the fetched page. Manual review is required to inspect the dynamic demo-drop page, confirm form/login controls, validate terms and verify genre/label fit before any upload.',
    notes:
      'Official Armada Music homepage lists Demo drop in the main navigation, shows featured releases, artists and current 2026 site footer. No dynamic form interaction, upload, login, protected-contact decoding or submission was attempted.'
  }
];
