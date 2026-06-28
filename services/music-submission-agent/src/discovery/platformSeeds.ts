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
  }
];
