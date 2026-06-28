import type { PlatformInput } from '../models/types.js';

export const run6SeedPlatforms: PlatformInput[] = [
  {
    name: 'We Rave You Artist Promotion Submission',
    websiteUrl: 'https://weraveyou.com/',
    submissionUrl: 'https://weraveyou.com/contact/',
    sourceUrl: 'https://weraveyou.com/contact/',
    sourceType: 'automation_run_6_public_research',
    country: 'Global / dance music audience',
    language: 'en',
    genres: [
      'house',
      'progressive house',
      'mainstage',
      'deep house',
      'future house',
      'techno',
      'trance',
      'dance pop',
      'drum and bass',
      'moombahton',
      'dubstep',
      'bass house',
      'trap',
      'electronic'
    ],
    submissionMethod: 'artist-track-url-contact-form',
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Official contact page exposes artist name, email, track URL, and message fields, but the page is framed as promotion/advertising and includes budget fields; campaign/payment expectations require manual approval.',
    notes:
      'Published business email general@weraveyou.com was syntax-valid only. No SMTP probing, MX probing, or generated email patterns were used. Contact page also contains hidden validation fields that must not be bypassed.'
  },
  {
    name: 'Dancing Astronaut Editorial / Advertising Contact',
    websiteUrl: 'https://dancingastronaut.com/',
    submissionUrl: 'https://dancingastronaut.com/contact',
    sourceUrl: 'https://dancingastronaut.com/',
    sourceType: 'automation_run_6_public_research',
    country: 'United States / global EDM audience',
    language: 'en',
    genres: ['edm', 'trap', 'techno', 'deep house', 'dubstep', 'electronic', 'bass music'],
    submissionMethod: 'editorial-contact-and-advertising-route',
    manualReviewRequired: true,
    manualReviewReason:
      'Homepage shows Contact Us and Advertise With Us routes and current music/news coverage, but the contact page could not be safely parsed in this run; manual route mapping is required before outreach.',
    notes:
      'Official homepage showed current June 2026 electronic music coverage and footer links to Contact Us and Advertise With Us. No form interaction was attempted.'
  },
  {
    name: 'Feature.fm Artist Marketing',
    websiteUrl: 'https://feature.fm/',
    submissionUrl: 'https://feature.fm/',
    sourceUrl: 'https://feature.fm/',
    sourceType: 'automation_run_6_public_research',
    country: 'United States / Israel / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'pop', 'independent'],
    submissionMethod: 'music-marketing-and-fan-capture-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist workflow starts through a login/start-for-free flow and creates marketing links, pre-saves, contests, fan capture, and analytics; account setup and campaign configuration require manual approval.',
    notes:
      'Useful as a compliant promotion infrastructure route rather than a curator submission. Official page lists release links, pre-save links, contest/unlock pages, fan management, and analytics.'
  },
  {
    name: 'Music Xray Song-to-Opportunity',
    websiteUrl: 'https://www.musicxray.com/',
    submissionUrl: 'https://www.musicxray.com/S2O',
    sourceUrl: 'https://www.musicxray.com/S2O',
    sourceType: 'automation_run_6_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'pop', 'songwriting', 'a-and-r'],
    submissionMethod: 'song-to-opportunity-a-and-r-platform',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Song-to-opportunity submissions can require login, paid submission fees, opportunity-specific rules, and human fit checks; no automated submission should run without approval.',
    notes:
      'Research source describes Music Xray as an active A&R platform where artists submit songs to industry professionals, often for a fee and guaranteed listen/response.'
  },
  {
    name: 'Hype Machine Blog Directory Discovery',
    websiteUrl: 'https://hypem.com/',
    submissionUrl: 'https://hypem.com/blogs',
    sourceUrl: 'https://hypem.com/',
    sourceType: 'automation_run_6_public_research',
    country: 'United States / global blog network',
    language: 'en',
    genres: ['electronic', 'bloghouse', 'indie', 'remixes', 'new music'],
    submissionMethod: 'music-blog-directory-for-manual-outreach',
    manualReviewRequired: true,
    manualReviewReason:
      'Hype Machine is a music-blog aggregator/directory, not a direct artist submission form; individual blog rules must be checked manually before any outreach.',
    notes:
      'Useful for discovering active music blogs that may cover electronic releases. No direct submission was attempted and no individual blog contacts were scraped.'
  },
  {
    name: 'Electrobel Electronic Artist Community',
    websiteUrl: 'http://www.electrobel.be/',
    submissionUrl: 'http://www.electrobel.be/',
    sourceUrl: 'http://www.electrobel.be/',
    sourceType: 'automation_run_6_public_research',
    country: 'Belgium / Luxembourg / France / Netherlands / United Kingdom / Ireland',
    language: 'en',
    genres: ['electronic', 'creative commons', 'underground electronic'],
    submissionMethod: 'electronic-community-upload',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Electronic-music community upload route is registration-based and country-limited, with Creative Commons licensing implications; manual eligibility and rights review are required.',
    notes:
      'Research source describes Electrobel as a free online electronic music artist community with submitted music and country-based membership limits. Current site/form state needs browser verification before use.'
  }
];
