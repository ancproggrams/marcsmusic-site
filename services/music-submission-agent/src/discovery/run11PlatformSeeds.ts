import type { PlatformInput } from '../models/types.js';

export const run11SeedPlatforms: PlatformInput[] = [
  {
    name: 'AWAL Online A&R Music Submission',
    websiteUrl: 'https://www.awal.com/',
    submissionUrl: 'https://www.awal.com/how-it-works',
    sourceUrl: 'https://www.awal.com/how-it-works',
    sourceType: 'automation_run_11_public_research',
    country: 'United Kingdom / United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'pop', 'hip hop', 'world', 'independent', 'label services'],
    submissionMethod: 'online-a-and-r-submission-for-select-independent-artist-label-services',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'AWAL uses a gated online A&R submission and selected-artist workflow. Catalog ownership, release status, rights, commercial terms, marketing fit and any application form requirements must be reviewed manually.',
    notes:
      'Official AWAL pages show Submit Your Music links, online A&R submission access, global distribution, release planning, worldwide playlisting, marketing, radio, sync and select-artist label services. No form was submitted.'
  },
  {
    name: 'Too Lost Music Distribution',
    websiteUrl: 'https://toolost.com/',
    submissionUrl: 'https://toolost.com/',
    sourceUrl: 'https://toolost.com/',
    sourceType: 'automation_run_11_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'independent', 'label', 'distribution', 'publishing'],
    submissionMethod: 'account-based-music-distribution-publishing-analytics-and-rights-workflow',
    loginRequired: true,
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Too Lost requires get-started/login, pricing or plan choice, release metadata, DSP selection, payout setup, rights ownership and distribution compliance review before any upload.',
    notes:
      'Official Too Lost pages describe delivery to hundreds of platforms, music distribution, publishing, analytics, splits and release tools. Treat as manual because it is an account-based commercial distribution workflow.'
  },
  {
    name: 'Vampr Music Industry Network and Collab Opportunities',
    websiteUrl: 'https://vampr.me/',
    submissionUrl: 'https://vampr.me/',
    sourceUrl: 'https://vampr.me/',
    sourceType: 'automation_run_11_public_research',
    country: 'United States / Australia / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'reggae', 'independent', 'collaboration', 'networking'],
    submissionMethod: 'music-industry-network-collaboration-and-opportunity-discovery-app',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Vampr opportunities require app/account access, creator profile review, collaboration scope, credits, publishing splits, ownership and direct-contact terms. No automated outreach should occur without manual approval.',
    notes:
      'Official Vampr pages show a global music-industry network for creatives, collaboration discovery and active public collab listings. Keep as manual-review discovery rather than auto-submit.'
  },
  {
    name: 'Sentric Music Publishing Join',
    websiteUrl: 'https://www.sentric.com/',
    submissionUrl: 'https://www.sentric.com/',
    sourceUrl: 'https://www.sentric.com/',
    sourceType: 'automation_run_11_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'independent', 'publishing', 'sync', 'royalties'],
    submissionMethod: 'publishing-administration-join-dashboard-for-artists-songwriters-and-publishers',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Sentric join/login requires publishing administration review, rights ownership checks, songwriter/publisher data, dashboard access and contract/deal terms before any work registration.',
    notes:
      'Official Sentric pages show Join and Log in routes, publishing administration, sync, deal options and dashboard support. Published business contacts support@sentricmusic.com and london@sentricmusic.com were syntax-visible only; no SMTP or MX probing was performed.'
  },
  {
    name: 'Songtrust Publishing Administration Join',
    websiteUrl: 'https://www.songtrust.com/',
    submissionUrl: 'https://app.songtrust.com/',
    sourceUrl: 'https://www.songtrust.com/',
    sourceType: 'automation_run_11_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'songwriting', 'publishing', 'royalties', 'independent'],
    submissionMethod: 'global-publishing-administration-and-royalty-collection-join-workflow',
    loginRequired: true,
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Songtrust requires account creation, pricing review, publishing terms, song ownership, songwriter splits, PRO or collection-society context and tax/payment details before registration.',
    notes:
      'Official Songtrust pages show Join, Client Login, pricing, global publishing royalty collection and a dashboard for adding songs and tracking royalties. No account or protected workflow was opened.'
  },
  {
    name: 'Soundrop Distribution and Cover Song Licensing',
    websiteUrl: 'https://soundrop.com/',
    submissionUrl: 'https://app.soundrop.com/',
    sourceUrl: 'https://soundrop.com/',
    sourceType: 'automation_run_11_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'cover songs', 'independent', 'distribution', 'royalties'],
    submissionMethod: 'sign-up-based-digital-distribution-cover-song-licensing-and-splits',
    loginRequired: true,
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Soundrop requires sign-up/login, per-track pricing, cover-song licensing checks, rights ownership, collaborator split setup, release metadata and payout review.',
    notes:
      'Official Soundrop pages describe distribution to major platforms, cover-song licensing, collaborator splits, monthly reporting and transparent per-track pricing. Keep manual due account/payment/rights workflow.'
  },
  {
    name: 'FUGA Distribution and Marketing Services',
    websiteUrl: 'https://fuga.com/',
    submissionUrl: 'https://fuga.com/',
    sourceUrl: 'https://fuga.com/',
    sourceType: 'automation_run_11_public_research',
    country: 'Netherlands / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'label', 'distribution', 'marketing', 'neighbouring rights'],
    submissionMethod: 'b2b-music-distribution-marketing-audio-visual-and-neighbouring-rights-services',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'FUGA is a B2B distribution and services route with login/contact/support paths. Label or management eligibility, commercial terms, catalog rights and onboarding must be reviewed manually.',
    notes:
      'Official FUGA pages show music distribution, physical distribution, marketing services, audio visual services, neighbouring rights, contact/support and login routes. No login or sales-contact workflow was opened.'
  },
  {
    name: 'BMI Songwriter and Publisher Affiliation',
    websiteUrl: 'https://www.bmi.com/',
    submissionUrl: 'https://www.bmi.com/join',
    sourceUrl: 'https://www.bmi.com/join',
    sourceType: 'automation_run_11_public_research',
    country: 'United States / international',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'songwriting', 'publishing', 'performance rights', 'royalties'],
    submissionMethod: 'songwriter-and-publisher-performing-rights-affiliation-application',
    loginRequired: true,
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'BMI affiliation requires application, agreement review, valid email, songwriter or publisher eligibility, publisher payment where applicable, tax/e-signature details and territory/PRO conflict checks.',
    notes:
      'Official BMI Join page offers songwriter and publisher affiliation, links to songwriter and publisher applications, shows publisher processing-fee/payment requirements and describes BMI representation at scale. Keep manual.'
  }
];
