import type { PlatformInput } from '../models/types.js';

export const run10SeedPlatforms: PlatformInput[] = [
  {
    name: 'TAXI A&R Music Industry Listings',
    websiteUrl: 'https://www.taxi.com/',
    submissionUrl: 'https://www.taxi.com/industry',
    sourceUrl: 'https://www.taxi.com/',
    sourceType: 'automation_run_10_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'pop', 'hip hop', 'world', 'instrumental', 'sync'],
    submissionMethod: 'a-and-r-industry-listings-for-sync-label-publishing-and-library-opportunities',
    loginRequired: true,
    feeRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'TAXI submissions require membership/login and each listing has opportunity-specific rights, eligibility, deadline, PRO, exclusivity, sample and AI-use constraints that must be approved manually.',
    notes:
      'Official TAXI pages show Submit Music / Industry Listings for labels, publishers, film/TV music supervisors, libraries, ads and games. Keep manual because join/member submission is required and listings contain detailed contractual restrictions.'
  },
  {
    name: 'Thematic Artist Song Campaigns',
    websiteUrl: 'https://hellothematic.com/',
    submissionUrl: 'https://app.hellothematic.com/artist-login',
    sourceUrl: 'https://app.hellothematic.com/artist-login',
    sourceType: 'automation_run_10_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['pop', 'electronic', 'electronic dance', 'indie pop', 'r&b', 'singer-songwriter', 'independent'],
    submissionMethod: 'creator-influencer-music-promotion-and-song-campaign-platform',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist campaign workflow requires account/login, rights confirmation, song-campaign setup, creator-placement terms and dashboard review before any upload or promotion activation.',
    notes:
      'Official Thematic artist page describes free song campaigns where creators use artists music in YouTube/TikTok videos and artists keep rights. Treat as manual because account and campaign configuration are required.'
  },
  {
    name: 'Uppbeat Artist and Composer Library',
    websiteUrl: 'https://uppbeat.io/',
    submissionUrl: 'https://uppbeat.io/browse/artist',
    sourceUrl: 'https://uppbeat.io/',
    sourceType: 'automation_run_10_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['electronic', 'edm', 'dubstep', 'future bass', 'world', 'cinematic', 'lofi', 'production music'],
    submissionMethod: 'royalty-free-music-library-artist-and-composer-roster',
    loginRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Public pages confirm an artist/composer contributor roster but no safe self-serve artist intake form was confirmed; roster/contact/onboarding terms must be reviewed manually.',
    notes:
      'Uppbeat is a Music Vine Limited brand with a browsable artist roster, royalty-free licensing and contributor/library positioning. Keep manual until an authorized current artist intake route is confirmed.'
  },
  {
    name: 'Musicbed Artist Licensing Roster',
    websiteUrl: 'https://www.musicbed.com/',
    submissionUrl: 'https://www.musicbed.com/artists',
    sourceUrl: 'https://www.musicbed.com/artists',
    sourceType: 'automation_run_10_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'ambient', 'cinematic', 'indie', 'hip hop', 'pop', 'world', 'licensing'],
    submissionMethod: 'music-licensing-roster-for-filmmakers-and-creative-projects',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist licensing/roster route requires human review of intake availability, account requirements, sync terms, exclusivity, master/publishing ownership and catalog fit.',
    notes:
      'Musicbed exposes an active artist roster with many electronic, ambient, cinematic, hip-hop and world artists plus login/create-account flows. No protected onboarding was opened.'
  },
  {
    name: 'Music Gorilla Artist Opportunities',
    websiteUrl: 'https://www.musicgorilla.com/',
    submissionUrl: 'https://www.musicgorilla.com/',
    sourceUrl: 'https://www.musicgorilla.com/',
    sourceType: 'automation_run_10_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'pop', 'rock', 'hip hop', 'sync', 'independent'],
    submissionMethod: 'artist-opportunities-for-label-film-tv-commercial-showcase-and-brand-placement',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist opportunity platform requires signup/login and opportunity-specific eligibility, fees, showcase, brand, film/TV and submission terms that must be reviewed per listing.',
    notes:
      'Official Music Gorilla page shows artist signup, current opportunities and submission routes for TV shows, commercials, feature films and more. Public page also showed unrelated injected/spammy text, so keep manual and do not auto-submit.'
  },
  {
    name: 'Crucial Music Artist Licensing Signup',
    websiteUrl: 'https://www.crucialmusic.com/',
    submissionUrl: 'https://www.crucialmusic.com/',
    sourceUrl: 'https://www.crucialmusic.com/',
    sourceType: 'automation_run_10_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'cinematic', 'independent', 'sync', 'advertising', 'film', 'television'],
    submissionMethod: 'artist-signup-for-curated-one-stop-sync-licensing-catalog',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Artist signup requires account creation, catalog review, rights ownership confirmation, deal-point review, sync licensing terms and possibly curator approval.',
    notes:
      'Official Crucial Music page offers Sign Up as New Artist and describes artist-friendly placement in films, shows and brand spots. Treat as manual because account and licensing terms are required.'
  },
  {
    name: 'Black Toast Music Open-Door Artist Submissions',
    websiteUrl: 'https://blacktoastmusic.com/',
    submissionUrl: 'https://blacktoastmusic.com/for-artists',
    sourceUrl: 'https://blacktoastmusic.com/for-artists',
    sourceType: 'automation_run_10_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'cinematic', 'independent', 'sync', 'production music', 'media licensing'],
    submissionMethod: 'open-door-artist-submissions-for-publisher-label-admin-and-sync-licensing',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Open-door route still requires onboarding, BTM Agreement review, song-by-song rights confirmation, exclusivity scope, collaborator paperwork and manual acceptance.',
    notes:
      'Official Black Toast For Artists page states that submissions are accepted almost year-round from ready artists after onboarding and agreement review. No form submission was attempted.'
  },
  {
    name: 'Sonicbids EPK and Live Booking Submissions',
    websiteUrl: 'https://sonicbids.com/',
    submissionUrl: 'https://app.sonicbids.com/',
    sourceUrl: 'https://sonicbids.com/',
    sourceType: 'automation_run_10_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'independent', 'live', 'festival', 'venue', 'showcase'],
    submissionMethod: 'epk-based-live-booking-venue-festival-and-showcase-submissions',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Sonicbids requires account signup/EPK claiming and live-booking submissions are still rolling out; gig, venue, festival and profile terms must be reviewed manually.',
    notes:
      'Official Sonicbids page says artists build an EPK, submit and get booked, with live EPKs available and submissions rolling out next. Keep manual until current submission workflows are available inside authorized account paths.'
  }
];
