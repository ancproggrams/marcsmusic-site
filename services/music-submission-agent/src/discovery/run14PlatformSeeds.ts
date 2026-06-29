import type { PlatformInput } from '../models/types.js';

export const run14SeedPlatforms: PlatformInput[] = [
  {
    name: 'Mixcloud Creator Upload and DJ Mix Discovery Route',
    websiteUrl: 'https://www.mixcloud.com/',
    submissionUrl: 'https://www.mixcloud.com/upload/',
    sourceUrl: 'https://www.mixcloud.com/',
    sourceType: 'automation_run_14_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['electronic', 'dj-mixes', 'radio-shows', 'podcasts', 'dance', 'bass'],
    submissionMethod: 'licensed-dj-mix-and-radio-show-upload-route-needs-account-and-rights-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Mixcloud is relevant for DJ mixes, radio shows and long-form electronic discovery, but upload requires a registered account, correct metadata and licensing/rights review before any MarcsMusic content is posted.',
    notes:
      'Research verified Mixcloud as an active global streaming/community platform for radio shows, DJ mixes and podcasts where registered users can upload content. No account, upload or protected workflow was accessed.'
  },
  {
    name: 'BandLab Artist Sharing and Distribution Route',
    websiteUrl: 'https://www.bandlab.com/',
    submissionUrl: 'https://www.bandlab.com/',
    sourceUrl: 'https://www.bandlab.com/',
    sourceType: 'automation_run_14_public_research',
    country: 'Singapore / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'collaboration', 'independent', 'distribution'],
    submissionMethod: 'creator-platform-sharing-and-distribution-route-needs-account-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'BandLab is an active creator platform with sharing and distribution functionality, but release posting, collaboration, artist profile, distribution settings and rights metadata require account-based manual review.',
    notes:
      'Research verified active global creator scale and distribution/social music features. No BandLab account, upload, distribution setup or private workflow was accessed.'
  },
  {
    name: 'Audius Artist Upload and Web3 Music Discovery Route',
    websiteUrl: 'https://audius.co/',
    submissionUrl: 'https://audius.co/upload',
    sourceUrl: 'https://audius.co/',
    sourceType: 'automation_run_14_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'dance', 'bass', 'independent', 'web3', 'creator-economy'],
    submissionMethod: 'artist-upload-and-discovery-platform-needs-account-wallet-and-rights-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Audius is relevant for independent electronic and dance discovery, but upload/account setup, wallet/token mechanics, metadata, ownership and rights implications require manual review.',
    notes:
      'Research verified Audius as a platform with artist uploads, listener feedback and significant dance/electronic relevance. No account, wallet, upload or protected route was accessed.'
  },
  {
    name: 'hearthis.at Artist Audio Distribution Route',
    websiteUrl: 'https://hearthis.at/',
    submissionUrl: 'https://hearthis.at/',
    sourceUrl: 'https://hearthis.at/',
    sourceType: 'automation_run_14_public_research',
    country: 'Germany / global',
    language: 'en',
    genres: ['electronic', 'dj-mixes', 'independent', 'audio-distribution', 'dance'],
    submissionMethod: 'artist-audio-upload-and-distribution-route-needs-account-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'hearthis.at is an audio distribution and promotion platform, but publishing requires registration, account settings, upload limits and rights/metadata review before use.',
    notes:
      'Research verified hearthis.at as active and registration-required for publishing. No signup, login, upload or protected workflow was accessed.'
  },
  {
    name: 'SoundClick Artist Upload Store and Licensing Route',
    websiteUrl: 'https://www.soundclick.com/',
    submissionUrl: 'https://www.soundclick.com/bandAdmin/default.cfm',
    sourceUrl: 'https://www.soundclick.com/',
    sourceType: 'automation_run_14_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'independent', 'licensing', 'music-store'],
    submissionMethod: 'artist-profile-upload-store-and-licensing-route-needs-account-review',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'SoundClick supports artist pages, uploads, streaming/download, store sales and licensing, but requires account configuration, pricing/licensing decisions and rights review before publishing.',
    notes:
      'Research verified SoundClick as a long-running artist upload, store and licensing community. VIP/promotional options may be paid. No account, payment, upload or store configuration was accessed.'
  },
  {
    name: 'Free Music Archive Artist and Curator Upload Route',
    websiteUrl: 'https://freemusicarchive.org/',
    submissionUrl: 'https://freemusicarchive.org/',
    sourceUrl: 'https://freemusicarchive.org/',
    sourceType: 'automation_run_14_public_research',
    country: 'Netherlands / global',
    language: 'en',
    genres: ['all', 'electronic', 'creative-commons', 'sync-friendly', 'independent'],
    submissionMethod: 'curated-free-music-library-route-needs-license-and-invitation-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Free Music Archive is a curated royalty-free/Creative Commons-oriented music library, but upload/edit permission is invitation-based and licensing terms must be reviewed manually.',
    notes:
      'Research verified FMA as a current royalty-free music repository with curated upload permissions. No curator access, account, invitation workflow or upload was attempted.'
  },
  {
    name: 'Volumo Electronic Music Store and Label Submission Route',
    websiteUrl: 'https://www.volumo.com/',
    submissionUrl: 'https://www.volumo.com/',
    sourceUrl: 'https://www.volumo.com/',
    sourceType: 'automation_run_14_public_research',
    country: 'Ukraine / Estonia / global',
    language: 'en',
    genres: ['electronic', 'techno', 'house', 'breakbeat', 'drum and bass', 'underground'],
    submissionMethod: 'curated-electronic-music-store-route-needs-label-artist-intake-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Volumo is relevant for underground electronic releases and DJ downloads, but its curated catalogue, label/artist onboarding, audio format, pricing and rights requirements must be reviewed manually.',
    notes:
      'Research verified Volumo as an active electronic music store focused on underground and niche genres. No store account, label onboarding, upload or protected submission route was accessed.'
  },
  {
    name: 'YANGAROO DMDS and Radio Delivery Route',
    websiteUrl: 'https://www.yangaroo.com/',
    submissionUrl: 'https://www.yangaroo.com/music/',
    sourceUrl: 'https://www.yangaroo.com/',
    sourceType: 'automation_run_14_public_research',
    country: 'Canada / global',
    language: 'en',
    genres: ['all', 'radio-promotion', 'music-video', 'independent', 'broadcast-delivery'],
    submissionMethod: 'paid-radio-and-broadcast-delivery-route-needs-campaign-review',
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'YANGAROO/DMDS is relevant for secure radio, TV and broadcast music delivery, but campaign targeting, costs, eligibility, assets and rights must be reviewed manually before any delivery.',
    notes:
      'Research verified YANGAROO as a music and entertainment content delivery platform for broadcasters and music professionals. No paid campaign, delivery, account or protected workflow was accessed.'
  }
];
