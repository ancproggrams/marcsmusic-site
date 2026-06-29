import type { PlatformInput } from '../models/types.js';

export const run7SeedPlatforms: PlatformInput[] = [
  {
    name: 'RouteNote Artist Distribution',
    websiteUrl: 'https://www.routenote.com/',
    submissionUrl: 'https://www.routenote.com/',
    sourceUrl: 'https://www.routenote.com/',
    sourceType: 'automation_run_7_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'dubstep', 'drum and bass', 'reggae', 'independent'],
    submissionMethod: 'artist-distribution-upload-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist distribution workflow requires account creation, release metadata, rights confirmation, store selection, and payout configuration; no automated submission should run without manual approval.',
    notes:
      'Verified as an active open digital distribution platform for artists with free and paid distribution paths. No business email was stored because no public, submission-specific business email was verified in this run.'
  },
  {
    name: 'Amuse Artist Distribution',
    websiteUrl: 'https://www.amuse.io/',
    submissionUrl: 'https://www.amuse.io/',
    sourceUrl: 'https://www.amuse.io/',
    sourceType: 'automation_run_7_public_research',
    country: 'Sweden / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'pop', 'independent'],
    submissionMethod: 'artist-distribution-upload-platform',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Self-service music distribution requires account setup, subscription/tier review, release metadata, ownership confirmation, and royalty/payout setup.',
    notes:
      'Verified as an active global music company offering digital music distribution and artist services. No email guessing, MX probing, or SMTP probing was performed.'
  },
  {
    name: 'LANDR Music Distribution',
    websiteUrl: 'https://www.landr.com/',
    submissionUrl: 'https://www.landr.com/',
    sourceUrl: 'https://www.landr.com/',
    sourceType: 'automation_run_7_public_research',
    country: 'Canada / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'independent', 'producer'],
    submissionMethod: 'music-distribution-and-release-platform',
    feeRequired: true,
    paymentRequired: true,
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Distribution/release workflow requires login, plan/payment review, release metadata, rights checks, and DSP selection; it is not safe for auto-submit.',
    notes:
      'Verified as an active music creation platform with distribution services. Treat as a compliant release-infrastructure route, not an editorial submission form.'
  },
  {
    name: 'TuneCore Music Distribution',
    websiteUrl: 'https://www.tunecore.com/',
    submissionUrl: 'https://www.tunecore.com/',
    sourceUrl: 'https://www.tunecore.com/',
    sourceType: 'automation_run_7_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'reggae', 'independent'],
    submissionMethod: 'music-distribution-and-publishing-platform',
    feeRequired: true,
    paymentRequired: true,
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Distribution and publishing-administration workflows require account setup, pricing/plan review, release metadata, rights verification, and royalty configuration.',
    notes:
      'Verified as an active independent digital music distribution, publishing, and licensing service. No public submission-specific email was stored.'
  },
  {
    name: 'DistroKid Music Distribution',
    websiteUrl: 'https://distrokid.com/',
    submissionUrl: 'https://distrokid.com/',
    sourceUrl: 'https://distrokid.com/',
    sourceType: 'automation_run_7_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'dubstep', 'independent'],
    submissionMethod: 'music-and-video-distribution-platform',
    feeRequired: true,
    paymentRequired: true,
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Annual subscription, account login, release metadata, store selection, rights checks, and optional video-distribution settings require manual review.',
    notes:
      'Verified as an active independent distribution service for music platforms and music video distribution. No upload/login flow was opened or bypassed.'
  },
  {
    name: 'CD Baby Digital Distribution',
    websiteUrl: 'https://cdbaby.com/',
    submissionUrl: 'https://cdbaby.com/',
    sourceUrl: 'https://cdbaby.com/',
    sourceType: 'automation_run_7_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'reggae', 'independent'],
    submissionMethod: 'digital-distribution-platform',
    feeRequired: true,
    paymentRequired: true,
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Digital distribution requires account, payment/fee review, release metadata, rights verification, and platform selection; physical distribution is no longer relevant for this route.',
    notes:
      'Verified as an active independent digital distributor after discontinuing physical media distribution. No public business email was stored.'
  },
  {
    name: 'Ditto Music Distribution',
    websiteUrl: 'https://dittomusic.com/',
    submissionUrl: 'https://dittomusic.com/',
    sourceUrl: 'https://dittomusic.com/',
    sourceType: 'automation_run_7_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'dubstep', 'reggae', 'independent'],
    submissionMethod: 'music-distribution-label-services-and-playlist-pitching-platform',
    feeRequired: true,
    paymentRequired: true,
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Distribution, label services, promotional services, and playlist pitching require login, plan review, campaign choices, rights checks, and payout configuration.',
    notes:
      'Verified as an active worldwide online music distribution company with distribution to major stores including Beatport-relevant routes. No automated signup or submission attempted.'
  },
  {
    name: 'BeatStars Producer Marketplace',
    websiteUrl: 'https://www.beatstars.com/',
    submissionUrl: 'https://www.beatstars.com/',
    sourceUrl: 'https://www.beatstars.com/',
    sourceType: 'automation_run_7_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['hip hop', 'trap', 'electronic', 'beats', 'producer', 'instrumental'],
    submissionMethod: 'producer-marketplace-licensing-and-distribution-platform',
    feeRequired: true,
    paymentRequired: true,
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Marketplace/licensing workflow requires account, subscription/plan review, license terms, rights ownership, metadata, and pricing decisions.',
    notes:
      'Relevant for MarcsMusic producer assets, instrumentals, and beat licensing. Treat as manual review because licensing terms must be selected by the artist.'
  }
];
