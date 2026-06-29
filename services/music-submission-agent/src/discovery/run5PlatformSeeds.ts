import type { PlatformInput } from '../models/types.js';

export const run5SeedPlatforms: PlatformInput[] = [
  {
    name: 'Stereofox Music Submissions',
    websiteUrl: 'https://www.stereofox.com/',
    submissionUrl: 'https://www.stereofox.com/contact/',
    sourceUrl: 'https://www.stereofox.com/contact/',
    sourceType: 'automation_run_5_public_research',
    country: 'Germany / global',
    language: 'en',
    genres: ['electronic', 'downtempo', 'beats', 'indie', 'pop', 'hip-hop'],
    submissionMethod: 'third-party-curator-marketplace',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Official contact page routes music submissions to SubmitHub or Groover; marketplace login, curator rules, and possible credits must be reviewed manually.',
    notes:
      'Official page says Stereofox does not process email/Discord music submissions and asks artists to use SubmitHub or Groover.'
  },
  {
    name: 'Mystic Sons Editorial Submissions',
    websiteUrl: 'https://www.mysticsons.com/',
    submissionUrl: 'https://www.mysticsons.com/contact/',
    sourceUrl: 'https://www.mysticsons.com/contact/',
    sourceType: 'automation_run_5_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['indie', 'electronic', 'pop', 'alternative', 'world'],
    submissionMethod: 'editorial-contact-form-and-marketplaces',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Official page exposes a contact form and published business emails, but it says guaranteed pitches should go through SubmitHub or Groover; manual routing is required.',
    notes:
      'Published emails info@mysticsons.com and james@mysticsons.com were syntax-valid only; no SMTP or MX probing was performed. Page explicitly says not to send MP3 attachments.'
  },
  {
    name: 'triple j Unearthed Upload',
    websiteUrl: 'https://www.abc.net.au/triplejunearthed',
    submissionUrl: 'https://www.abc.net.au/triplejunearthed',
    sourceUrl: 'https://www.abc.net.au/triplejunearthed',
    sourceType: 'automation_run_5_public_research',
    country: 'Australia',
    language: 'en',
    genres: ['electronic', 'dance', 'beats', 'pop', 'indie', 'experimental'],
    submissionMethod: 'public-broadcaster-artist-upload',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Active emerging-artist platform with recent reviews and electronic/dance coverage, but account and Australian artist eligibility restrictions require manual review.',
    notes:
      'Homepage showed 2026 featured artists, tracks, recent staff reviews, and electronic/dance/beats genre coverage.'
  },
  {
    name: 'BBC Music Introducing Upload',
    websiteUrl: 'https://www.bbc.co.uk/introducing',
    submissionUrl: 'https://www.bbc.co.uk/introducing',
    sourceUrl: 'https://www.bbc.co.uk/introducing',
    sourceType: 'automation_run_5_public_research',
    country: 'United Kingdom',
    language: 'en',
    genres: ['electronic', 'dance', 'new music', 'unsigned', 'independent'],
    submissionMethod: 'public-broadcaster-artist-upload',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'BBC Introducing upload route is account and UK-postcode/region based; official pages are not safe for automated form interaction in this run.',
    notes:
      'Kept manual-only because it is a regional broadcaster upload workflow requiring authenticated artist access and eligibility checks.'
  },
  {
    name: 'Amazing Radio / AmazingTunes Upload',
    websiteUrl: 'https://amazingtunes.com/',
    submissionUrl: 'https://amazingtunes.com/',
    sourceUrl: 'https://amazingtunes.com/',
    sourceType: 'automation_run_5_public_research',
    country: 'United Kingdom / United States / global',
    language: 'en',
    genres: ['electronic', 'indie', 'pop', 'alternative', 'emerging artists'],
    submissionMethod: 'artist-upload-radio-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Official landing page invites artists to upload music to Amazing Radio, but the upload workflow is app/account based and needs browser/manual mapping.',
    notes: 'AmazingTunes page states artists can upload music to Amazing Radio for airplay and playlist featuring.'
  },
  {
    name: 'Radio Airplay by Jango',
    websiteUrl: 'https://www.radioairplay.com/',
    submissionUrl: 'https://www.radioairplay.com/music+promotion/guaranteed_airplay',
    sourceUrl: 'https://www.radioairplay.com/',
    sourceType: 'automation_run_5_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'dance', 'pop', 'indie', 'world', 'reggae'],
    submissionMethod: 'internet-radio-promotion-platform',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Platform requires signup and offers paid airplay packages; campaign budget, account workflow, and platform rules require manual approval.',
    notes:
      'Published business email premium@radioairplay.com was syntax-valid only; no SMTP or MX probing was performed.'
  },
  {
    name: 'RepostExchange',
    websiteUrl: 'https://repostexchange.com/',
    submissionUrl: 'https://repostexchange.com/welcome',
    sourceUrl: 'https://repostexchange.com/',
    sourceType: 'automation_run_5_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['electronic', 'edm', 'deep house', 'trap', 'ambient', 'hip-hop'],
    submissionMethod: 'soundcloud-promotion-network',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Route requires SoundCloud OAuth/account connection and manual campaign/credit choices; no account or API action should be automated without approval.',
    notes:
      'Official page says RepostExchange is a SoundCloud partner, uses credits, and requires connecting SoundCloud before promoting tracks.'
  },
  {
    name: 'SoundCampaign',
    websiteUrl: 'https://soundcamps.com/',
    submissionUrl: 'https://app.soundcamps.com/',
    sourceUrl: 'https://soundcamps.com/',
    sourceType: 'automation_run_5_public_research',
    country: 'Global',
    language: 'en',
    genres: ['electronic', 'spotify playlists', 'tiktok', 'pop', 'dance', 'independent'],
    submissionMethod: 'paid-playlist-and-tiktok-campaign-platform',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Campaign route requires account login, budget selection, curator/creator review costs, and compliance review before use.',
    notes:
      'Official site describes paid Spotify playlist and TikTok music promotion campaigns with curator feedback; no campaign was started.'
  }
];
