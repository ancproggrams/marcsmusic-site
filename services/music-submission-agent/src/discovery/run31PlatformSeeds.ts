import type { PlatformInput } from '../models/types.js';

export const run31SeedPlatforms: PlatformInput[] = [
  {
    name: 'WPRK 91.5FM Rollins Music Submissions Route',
    websiteUrl: 'https://wprk.org/',
    submissionUrl: 'https://wprk.org/music-submissions/',
    sourceUrl: 'https://wprk.org/music-submissions/',
    sourceType: 'automation_run_31_public_research',
    country: 'United States / Winter Park Florida / Orlando college-radio and community-radio audience',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'dub',
      'reggae',
      'hip-hop',
      'r-and-b',
      'indie',
      'alternative',
      'rock',
      'latin',
      'world',
      'jazz',
      'college-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-music-submissions-page-with-official-music-email-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WPRK publishes a public music-submissions email route, but outreach copy, clean/radio-safe assets, genre fit, rights and attachment/link policy require owner/manual review before any email is sent.',
    notes:
      'Official WPRK Music Submissions page asks artists to send submissions to the public station music email. Site schedule shows active reggae, electronic, hip-hop, Latin and alternative programming. No email, form, upload, login or payment action was attempted.'
  },
  {
    name: 'Fredonia Radio Systems WCVF Airplay Inquiry Route',
    websiteUrl: 'https://www.fredoniaradio.com/',
    submissionUrl: 'https://www.fredoniaradio.com/',
    sourceUrl: 'https://www.fredoniaradio.com/',
    sourceType: 'automation_run_31_public_research',
    country: 'United States / Fredonia New York / SUNY Fredonia college-radio and local-music audience',
    language: 'en',
    genres: [
      'electronic',
      'hip-hop',
      'indie',
      'alternative',
      'rock',
      'folk',
      'blues',
      'jazz',
      'local-music',
      'college-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-homepage-airplay-inquiry-email-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Fredonia Radio Systems lists a public music air-play inquiry contact, but exact WCVF/WDVL targeting, radio-clean files, metadata, local/show fit and outreach wording require manual review.',
    notes:
      'Official Fredonia Radio Systems homepage lists WCVF 88.9 and WDVL 89.5 streams plus a public music air-play inquiry email. No email, form, upload, login or payment action was attempted.'
  },
  {
    name: 'WRFL 88.1 FM Lexington Contact-Gated Music Review Route',
    websiteUrl: 'https://wrfl.fm/',
    submissionUrl: 'https://wrfl.fm/contact',
    sourceUrl: 'https://wrfl.fm/contact',
    sourceType: 'automation_run_31_public_research',
    country: 'United States / Lexington Kentucky / University of Kentucky independent college-radio audience',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'experimental',
      'hip-hop',
      'reggae',
      'world',
      'jazz',
      'indie',
      'alternative',
      'punk',
      'metal',
      'local-music',
      'college-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-contact-page-for-appropriate-director-routing',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WRFL publishes a public contact page and active 2026 schedule/playlist pages, but does not expose a safe one-click music submission form in the crawled static content; director targeting and current submission rules require manual review.',
    notes:
      'Official WRFL site shows Summer 2026 programming, playlist categories including General/Local/Specialty Rotation, and a public contact page. No email, form, upload, login or payment action was attempted.'
  },
  {
    name: 'WRIR-LP 97.3 Richmond Music Programming Contact Route',
    websiteUrl: 'https://www.wrir.org/',
    submissionUrl: 'https://www.wrir.org/',
    sourceUrl: 'https://www.wrir.org/',
    sourceType: 'automation_run_31_public_research',
    country: 'United States / Richmond Virginia / independent low-power community-radio audience',
    language: 'en',
    genres: [
      'electronic',
      'house',
      'disco',
      'reggae',
      'soca',
      'soul',
      'hip-hop',
      'latin',
      'world',
      'punk',
      'indie',
      'alternative',
      'folk',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-station-contact-and-program-targeting-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WRIR has active music programming and public station contact information, but music-review targeting appears presenter/show-specific and crawler output redacts protected contact links; manual review is required before outreach.',
    notes:
      'Official WRIR homepage shows current 2026 playlists/posts, music schedules including reggae/soul/house/alternative programming and public contact sections. No protected email decoding, email, form, upload, login or payment action was attempted.'
  },
  {
    name: 'WHUS 91.7 FM UConn New Music Committee Route',
    websiteUrl: 'https://whus.org/',
    submissionUrl: 'https://whus.org/',
    sourceUrl: 'https://whus.org/',
    sourceType: 'automation_run_31_public_research',
    country: 'United States / Storrs Connecticut / UConn college-radio and eastern Connecticut community audience',
    language: 'en',
    genres: [
      'electronic',
      'experimental',
      'indie',
      'alternative',
      'hip-hop',
      'rock',
      'jazz',
      'world',
      'talk',
      'local-music',
      'college-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-new-music-committee-and-station-contact-review-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WHUS exposes a New Music Committee route and active music coverage, but the static crawl does not provide a safe complete submission workflow; correct department contact, asset packaging and college-radio fit require manual review.',
    notes:
      'Official WHUS site shows New Music Committee navigation, 2026 music/news posts, stream/schedule links and public station contact details. No email, form, upload, login or payment action was attempted.'
  }
];
