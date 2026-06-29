import type { PlatformInput } from '../models/types.js';

export const seedPlatforms: PlatformInput[] = [
  {
    name: 'Groover',
    websiteUrl: 'https://groover.co/',
    submissionUrl: 'https://groover.co/',
    country: 'France',
    language: 'en',
    genres: ['electronic', 'pop', 'indie', 'hip-hop'],
    submissionMethod: 'marketplace',
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Marketplace route can require payment and account workflow before submission.'
  },
  {
    name: 'SubmitHub',
    websiteUrl: 'https://www.submithub.com/',
    submissionUrl: 'https://www.submithub.com/',
    country: 'United States',
    language: 'en',
    genres: ['electronic', 'pop', 'indie', 'hip-hop', 'rock'],
    submissionMethod: 'marketplace',
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Submission marketplace can require login, credits, and curator-specific rules.'
  },
  {
    name: 'LabelRadar',
    websiteUrl: 'https://www.labelradar.com/',
    submissionUrl: 'https://www.labelradar.com/',
    country: 'United Kingdom',
    language: 'en',
    genres: ['electronic', 'dance'],
    submissionMethod: 'portal',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Submission workflow is account-gated.'
  },
  {
    name: 'Beatport Greenroom',
    websiteUrl: 'https://www.beatportal.com/',
    submissionUrl: 'https://www.beatportal.com/features/beatport-greenroom/',
    country: 'United States',
    language: 'en',
    genres: ['electronic', 'dance'],
    submissionMethod: 'program',
    manualReviewRequired: true,
    manualReviewReason: 'Program route requires human eligibility review before outreach.'
  },
  {
    name: 'Spotify for Artists',
    websiteUrl: 'https://artists.spotify.com/',
    submissionUrl: 'https://artists.spotify.com/',
    country: 'Worldwide',
    language: 'en',
    genres: ['all'],
    submissionMethod: 'artist-dashboard',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Editorial pitching requires authenticated Spotify for Artists access.'
  },
  {
    name: 'Soundplate',
    websiteUrl: 'https://soundplate.com/',
    submissionUrl: 'https://soundplate.com/submit-music/',
    country: 'United Kingdom',
    language: 'en',
    genres: ['electronic', 'dance', 'house', 'techno'],
    submissionMethod: 'public-form'
  },
  {
    name: 'Playlist Partner',
    websiteUrl: 'https://playlistpartner.com/',
    submissionUrl: 'https://playlistpartner.com/',
    country: 'United States',
    language: 'en',
    genres: ['pop', 'electronic', 'hip-hop'],
    submissionMethod: 'public-form'
  },
  {
    name: 'DailyPlaylists',
    websiteUrl: 'https://dailyplaylists.com/',
    submissionUrl: 'https://dailyplaylists.com/',
    country: 'Worldwide',
    language: 'en',
    genres: ['all'],
    submissionMethod: 'portal',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Playlist submission portal requires account/session review.'
  },
  {
    name: 'Music Bloggers Network',
    websiteUrl: 'https://musicbloggersnetwork.com/',
    submissionUrl: 'https://musicbloggersnetwork.com/',
    country: 'Worldwide',
    language: 'en',
    genres: ['indie', 'pop', 'electronic'],
    submissionMethod: 'directory',
    manualReviewRequired: true,
    manualReviewReason: 'Directory requires manual verification of individual publisher rules.'
  },
  {
    name: 'Channel R Rising',
    websiteUrl: 'https://channelrradio.com/',
    submissionUrl: 'https://channelrradio.com/rising/',
    country: 'United Kingdom',
    language: 'en',
    genres: ['pop', 'dance', 'electronic'],
    submissionMethod: 'public-form'
  },
  {
    name: 'KXT',
    websiteUrl: 'https://kxt.org/',
    submissionUrl: 'https://kxt.org/',
    country: 'United States',
    language: 'en',
    genres: ['indie', 'alternative', 'singer-songwriter'],
    submissionMethod: 'editorial',
    manualReviewRequired: true,
    manualReviewReason: 'Station-specific editorial route requires manual policy review.'
  },
  {
    name: 'Armada',
    websiteUrl: 'https://www.armadamusic.com/',
    submissionUrl: 'https://www.armadamusic.com/demo-drop',
    country: 'Netherlands',
    language: 'en',
    genres: ['electronic', 'trance', 'house'],
    submissionMethod: 'demo-drop'
  },
  {
    name: "Spinnin' Records",
    websiteUrl: 'https://spinninrecords.com/',
    submissionUrl: 'https://spinninrecords.com/talentpool',
    country: 'Netherlands',
    language: 'en',
    genres: ['electronic', 'dance', 'house'],
    submissionMethod: 'portal',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Talent pool submissions can require account or protected upload workflow.'
  },
  {
    name: 'Monstercat',
    websiteUrl: 'https://www.monstercat.com/',
    submissionUrl: 'https://www.monstercat.com/demo',
    country: 'Canada',
    language: 'en',
    genres: ['electronic', 'bass', 'dance'],
    submissionMethod: 'demo-drop'
  },
  {
    name: 'NCS',
    websiteUrl: 'https://ncs.io/',
    submissionUrl: 'https://ncs.io/submission',
    country: 'United Kingdom',
    language: 'en',
    genres: ['electronic', 'dance', 'bass'],
    submissionMethod: 'demo-drop'
  },
  {
    name: 'Future House Music',
    websiteUrl: 'https://www.futurehousemusic.com/',
    submissionUrl: 'https://www.futurehousemusic.com/submit-demo',
    country: 'Netherlands',
    language: 'en',
    genres: ['future house', 'dance', 'electronic'],
    submissionMethod: 'demo-drop'
  },
  {
    name: 'Musosoup',
    websiteUrl: 'https://musosoup.com/',
    submissionUrl: 'https://musosoup.com/',
    country: 'United Kingdom',
    language: 'en',
    genres: ['all'],
    submissionMethod: 'marketplace',
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Campaign workflow can require account, payment, and campaign approval.'
  },
  {
    name: 'Playlist Push',
    websiteUrl: 'https://playlistpush.com/',
    submissionUrl: 'https://playlistpush.com/',
    country: 'United States',
    language: 'en',
    genres: ['pop', 'hip-hop', 'electronic'],
    submissionMethod: 'marketplace',
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Campaign workflow can require payment and platform approval.'
  },
  {
    name: 'One Submit',
    websiteUrl: 'https://www.one-submit.com/',
    submissionUrl: 'https://www.one-submit.com/',
    country: 'Worldwide',
    language: 'en',
    genres: ['all'],
    submissionMethod: 'marketplace',
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Submission marketplace can require paid campaign setup.'
  },
  {
    name: 'A&R Factory',
    websiteUrl: 'https://www.anrfactory.com/',
    submissionUrl: 'https://www.anrfactory.com/submit-music/',
    country: 'United Kingdom',
    language: 'en',
    genres: ['all'],
    submissionMethod: 'public-form'
  },
  {
    name: 'SoundCloud for Artists',
    websiteUrl: 'https://soundcloud.com/',
    submissionUrl: 'https://soundcloud.com/upload',
    sourceUrl: 'https://soundcloud.com/',
    sourceType: 'automation_run_4_public_research',
    country: 'Worldwide',
    language: 'en',
    genres: ['electronic', 'dubstep', 'bass', 'reggae', 'world', 'pop'],
    submissionMethod: 'artist-upload',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Direct upload and artist services require authenticated artist account and rights/policy review before submission.',
    notes:
      'Active global audio platform suitable for MarcsMusic discovery; keep manual because upload requires account access and asset-rights confirmation.'
  },
  {
    name: 'Audiomack Creator Upload',
    websiteUrl: 'https://audiomack.com/',
    submissionUrl: 'https://audiomack.com/upload',
    sourceUrl: 'https://audiomack.com/',
    sourceType: 'automation_run_4_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'afrobeats', 'hip-hop', 'r&b', 'latin', 'reggae'],
    submissionMethod: 'artist-upload',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Creator upload requires authenticated account and rights confirmation; no login or policy bypass is allowed.',
    notes:
      'Free creator upload/discovery route, but not auto-submitted because account access and ownership checks are required.'
  },
  {
    name: 'SoundOn by TikTok',
    websiteUrl: 'https://www.soundon.global/',
    submissionUrl: 'https://www.soundon.global/',
    sourceUrl: 'https://www.soundon.global/',
    sourceType: 'automation_run_4_public_research',
    country: 'Selected global markets',
    language: 'en',
    genres: ['electronic', 'dance', 'bass', 'pop', 'reggae'],
    submissionMethod: 'distribution-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason: 'Distribution route requires account, rights, market eligibility, and release metadata review.',
    notes:
      'TikTok-owned distribution route relevant for TikTok/Reels-style music discovery; manual review required for territory and rights checks.'
  },
  {
    name: 'ReverbNation Opportunities',
    websiteUrl: 'https://www.reverbnation.com/',
    submissionUrl: 'https://www.reverbnation.com/band-promotion/opportunities',
    sourceUrl: 'https://www.reverbnation.com/',
    sourceType: 'automation_run_4_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'pop', 'hip-hop', 'rock', 'world'],
    submissionMethod: 'opportunities-platform',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Opportunity submissions require account workflow and may require paid promotion or opportunity-specific terms.',
    notes:
      'Active independent-music platform; opportunity matching is useful but must stay manual because campaigns and terms vary.'
  },
  {
    name: 'Broadjam Opportunities',
    websiteUrl: 'https://www.broadjam.com/',
    submissionUrl: 'https://www.broadjam.com/delivery/submission.php',
    sourceUrl: 'https://www.broadjam.com/',
    sourceType: 'automation_run_4_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'pop', 'world', 'reggae', 'film-tv-sync'],
    submissionMethod: 'opportunities-and-reviews',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Submissions for radio, reviews, contests, or licensing opportunities require member account and opportunity-specific fee/rules review.',
    notes:
      'Useful for radio/pro review/sync opportunities, but must remain manual due to account and paid opportunity constraints.'
  },
  {
    name: 'Bandcamp Artist Upload',
    websiteUrl: 'https://bandcamp.com/',
    submissionUrl: 'https://bandcamp.com/artists',
    sourceUrl: 'https://bandcamp.com/',
    sourceType: 'automation_run_4_public_research',
    country: 'Worldwide',
    language: 'en',
    genres: ['electronic', 'dub', 'reggae', 'bass', 'world', 'independent'],
    submissionMethod: 'artist-upload-storefront',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist upload requires account setup, release ownership, pricing, and generative-AI policy review before use.',
    notes:
      'Strong independent artist storefront/discovery route; manual review is required because Bandcamp policy around AI-generated music may affect Suno-assisted tracks.'
  }
];
