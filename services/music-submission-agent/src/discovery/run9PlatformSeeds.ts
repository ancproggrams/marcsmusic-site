import type { PlatformInput } from '../models/types.js';

export const run9SeedPlatforms: PlatformInput[] = [
  {
    name: 'Songtradr Music Licensing Marketplace',
    websiteUrl: 'https://www.songtradr.com/',
    submissionUrl: 'https://www.songtradr.com/',
    sourceUrl: 'https://www.songtradr.com/',
    sourceType: 'automation_run_9_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'dubstep', 'reggae', 'world', 'independent'],
    submissionMethod: 'music-licensing-marketplace-and-sync-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Licensing marketplace workflow requires account setup, rights ownership checks, catalog metadata, splits, pricing/licensing terms and opt-in review before any upload or sync submission.',
    notes:
      'Public sources describe Songtradr as a B2B music licensing marketplace where artists can upload music and set licensing fees. Keep manual because rights, splits, licensing scope and account workflow must be reviewed.'
  },
  {
    name: 'Jamendo Artist Upload and Licensing',
    websiteUrl: 'https://www.jamendo.com/',
    submissionUrl: 'https://www.jamendo.com/',
    sourceUrl: 'https://www.jamendo.com/',
    sourceType: 'automation_run_9_public_research',
    country: 'Luxembourg / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'reggae', 'world', 'independent', 'instrumental'],
    submissionMethod: 'artist-upload-creative-commons-and-commercial-licensing-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist upload/licensing workflow requires account creation, license selection, rights confirmation, collecting-society eligibility review, metadata and commercial licensing opt-in decisions.',
    notes:
      'Jamendo is a global independent music platform and licensing marketplace for artists. Treat as manual because license selection and collecting-society restrictions can materially affect MarcsMusic rights.'
  },
  {
    name: 'Epidemic Sound Artist Roster',
    websiteUrl: 'https://www.epidemicsound.com/',
    submissionUrl: 'https://www.epidemicsound.com/',
    sourceUrl: 'https://www.epidemicsound.com/',
    sourceType: 'automation_run_9_public_research',
    country: 'Sweden / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'cinematic', 'reggae', 'world', 'instrumental'],
    submissionMethod: 'production-music-library-and-artist-roster',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist roster/library workflows require eligibility review, creator contract review, rights transfer/licensing terms, streaming split assessment and account/onboarding approval.',
    notes:
      'Epidemic Sound is active globally in royalty-free soundtrack licensing and works with artists under specific commercial terms. Keep manual because contract terms and rights implications must be reviewed before any submission.'
  },
  {
    name: 'Marmoset Music Licensing Artist Roster',
    websiteUrl: 'https://www.marmosetmusic.com/',
    submissionUrl: 'https://www.marmosetmusic.com/',
    sourceUrl: 'https://www.marmosetmusic.com/',
    sourceType: 'automation_run_9_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'cinematic', 'independent', 'world', 'instrumental'],
    submissionMethod: 'sync-licensing-agency-and-curated-music-roster',
    loginRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Curated roster/licensing route requires human review of fit, exclusivity, publishing/master rights, sync terms and any submission/contact workflow before outreach.',
    notes:
      'Marmoset represents emerging and independent artists, bands and labels for licensing. No protected form was opened and no business email was guessed.'
  },
  {
    name: 'Pond5 Music Contributor Marketplace',
    websiteUrl: 'https://www.pond5.com/',
    submissionUrl: 'https://www.pond5.com/',
    sourceUrl: 'https://www.pond5.com/',
    sourceType: 'automation_run_9_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'cinematic', 'stock music', 'sound effects', 'instrumental'],
    submissionMethod: 'stock-music-and-media-contributor-marketplace',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Contributor marketplace requires account onboarding, contributor terms, asset metadata, pricing, royalty/payment setup and licensing-rights review.',
    notes:
      'Pond5 is a global stock media marketplace that licenses stock music and sound effects. Keep manual due to contributor-account and licensing-term review.'
  },
  {
    name: 'Audiosocket Music Licensing Roster',
    websiteUrl: 'https://www.audiosocket.com/',
    submissionUrl: 'https://www.audiosocket.com/',
    sourceUrl: 'https://www.audiosocket.com/',
    sourceType: 'automation_run_9_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'independent', 'cinematic', 'world', 'instrumental'],
    submissionMethod: 'music-licensing-technology-and-roster-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Licensing roster workflow requires account or curator onboarding, rights verification, sync licensing terms, metadata and payment/royalty review.',
    notes:
      'Audiosocket is a music licensing and technology company used by filmmakers and creative platforms. Keep manual until an authorized current artist-intake route is confirmed and terms are reviewed.'
  },
  {
    name: 'ALIBI Music Artist and Composer Library',
    websiteUrl: 'https://alibimusic.com/',
    submissionUrl: 'https://alibimusic.com/',
    sourceUrl: 'https://alibimusic.com/',
    sourceType: 'automation_run_9_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'cinematic', 'trailer', 'advertising', 'instrumental'],
    submissionMethod: 'production-music-library-for-sync-licensing',
    loginRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Production-music library route requires human review of composer/artist fit, master/publishing ownership, exclusivity, stems/alt requirements and sync licensing terms.',
    notes:
      'ALIBI Music is a global production music company with a roster of composers and artists whose work is included in its library. No form submission was attempted.'
  },
  {
    name: 'Envato AudioJungle Music Author Marketplace',
    websiteUrl: 'https://audiojungle.net/',
    submissionUrl: 'https://author.envato.com/',
    sourceUrl: 'https://audiojungle.net/',
    sourceType: 'automation_run_9_public_research',
    country: 'Australia / global',
    language: 'en',
    genres: ['all', 'electronic', 'cinematic', 'corporate', 'stock music', 'sound effects', 'instrumental'],
    submissionMethod: 'stock-music-author-marketplace',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Author marketplace requires account creation, item review, licensing-term approval, pricing, payout/tax setup, metadata, and policy review before any upload.',
    notes:
      'AudioJungle is an Envato-operated stock music marketplace. Keep manual because stock licensing terms and content-review workflow require explicit approval.'
  }
];
