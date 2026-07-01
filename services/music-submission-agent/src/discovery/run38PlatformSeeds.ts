import type { PlatformInput } from '../models/types.js';

export const run38SeedPlatforms: PlatformInput[] = [
  {
    name: 'SXSW 2027 Music Festival Showcase Application',
    websiteUrl: 'https://www.sxsw.com/festivals/music/',
    submissionUrl: 'https://cart.sxsw.com/products/music-festival-showcase',
    sourceUrl: 'https://cart.sxsw.com/products/music-festival-showcase',
    sourceType: 'automation_run_38_public_research',
    country: 'United States / global music industry showcase festival',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'reggae',
      'dub',
      'world',
      'pop',
      'hip-hop',
      'bass-music',
      'live-showcase',
      'industry-showcase'
    ],
    submissionMethod: 'official-public-paid-showcase-application-cart-route',
    feeRequired: true,
    feeAmount: '$35 early application rate; rate increases after September 1 2026; final deadline November 20 2026',
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'SXSW Music Festival showcase applications are open for 2027 but the official route is a paid cart/application flow with deadline-dependent pricing, account/checkout steps, rights and performance-material review. Owner approval is required before any application.',
    notes:
      'Official SXSW pages show SXSW 2027 runs March 15-21 2027 and that Music Festival Showcase applications are open. The cart page lists the Music Festival Showcase application, an early fee, a September 1 2026 rate increase and a November 20 2026 closing deadline. No account, checkout, form submission or payment was attempted.'
  },
  {
    name: 'The New Colossus Festival 2027 Artist Application',
    websiteUrl: 'https://www.newcolossusfestival.com/',
    submissionUrl: 'https://www.newcolossusfestival.com/apply',
    sourceUrl: 'https://www.newcolossusfestival.com/apply',
    sourceType: 'automation_run_38_public_research',
    country: 'United States / international emerging artist showcase festival',
    language: 'en',
    genres: [
      'indie',
      'alternative',
      'electronic',
      'world',
      'pop',
      'rock',
      'live-showcase',
      'music-conference',
      'emerging-artist'
    ],
    submissionMethod: 'official-public-paid-artist-application-form-with-checkout',
    feeRequired: true,
    feeAmount: '$100 non-refundable application fee',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'The official 2027 application is live, but it includes a non-refundable application fee, eligibility restrictions, a checkout step and a specific rule that applications are not accepted by email. Manual owner approval is required before applying.',
    notes:
      'Official application page lists the 2027 festival dates as March 9-14 2027, an application deadline of December 1 2026 and info@newcolossusfestival.com for questions only. It also says no applications by email, no cover/tribute acts and no artists that performed 2019-2026. No form or checkout was submitted.'
  },
  {
    name: 'BBC Music Introducing Uploader',
    websiteUrl: 'https://www.bbc.co.uk/introducing',
    submissionUrl: 'https://www.bbc.co.uk/music/introducing/uploader/',
    sourceUrl: 'https://www.bbc.co.uk/introducing',
    sourceType: 'automation_run_38_public_research',
    country: 'United Kingdom / BBC local and national new-music discovery network',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'bass-music',
      'reggae',
      'dub',
      'pop',
      'hip-hop',
      'uk-new-music',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-uploader-route-requiring-registration-postcode-and-ugc-review',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'BBC Music Introducing is an uploader/account route for unsigned or under-the-radar UK talent. Registration, postcode-based routing, UGC terms, locality/eligibility, rights ownership and suitability for BBC radio require manual review before upload.',
    notes:
      'The official BBC Introducing URL was protected from automated fetching during research, so the route was cross-checked through public reference material describing BBC Music Introducing as active and documenting the official upload tool that routes artists to local Introducing producers and presenters. No account or upload was attempted.'
  },
  {
    name: 'triple j Unearthed Artist Upload',
    websiteUrl: 'https://www.abc.net.au/triplejunearthed/',
    submissionUrl: 'https://help.abc.net.au/hc/en-us/articles/360001151315-How-do-I-upload-my-music-to-triple-j-Unearthed',
    sourceUrl: 'https://help.abc.net.au/hc/en-us/articles/360001151315-How-do-I-upload-my-music-to-triple-j-Unearthed',
    sourceType: 'automation_run_38_public_research',
    country: 'Australia / ABC triple j Unearthed independent-artist platform',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'bass-music',
      'reggae',
      'dub',
      'hip-hop',
      'pop',
      'independent-music',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-abc-account-artist-profile-track-upload-route',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'triple j Unearthed requires an ABC account, artist profile, original material and Australian citizen/resident eligibility checks. Because MarcsMusic is not automatically eligible, this must stay manual and no platform restriction may be bypassed.',
    notes:
      'Official ABC help explains that artists create an ABC account, create an artist profile and upload tracks through Manage Tracks, and that the team listens before approval. Eligibility help requires original/no-major-label tracks and Australian citizen or resident status. No account or upload was attempted.'
  },
  {
    name: 'ccMixter Creative Commons Upload and Remix Community',
    websiteUrl: 'https://ccmixter.org/',
    submissionUrl: 'https://ccmixter.org/',
    sourceUrl: 'https://ccmixter.org/',
    sourceType: 'automation_run_38_public_research',
    country: 'Global / Creative Commons remix and sample-sharing music community',
    language: 'en',
    genres: [
      'electronic',
      'dub',
      'world',
      'hip-hop',
      'remix',
      'samples',
      'a-cappella',
      'creative-commons',
      'producer-community'
    ],
    submissionMethod: 'official-public-community-upload-route-with-creative-commons-license-review',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'ccMixter is a Creative Commons remix community, so upload requires account access, license selection, rights ownership, attribution and remix/sample-clearance review. Owner approval is required before releasing stems, a cappellas or remixes under an open license.',
    notes:
      'Public reference material identifies ccMixter as worldwide, free and focused on Creative Commons samples, remixes and a cappellas. It is relevant for controlled remix/stem exposure, not for automated promotional uploads. No account, upload or license grant was attempted.'
  }
];
