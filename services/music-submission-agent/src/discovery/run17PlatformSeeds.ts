import type { PlatformInput } from '../models/types.js';

export const run17SeedPlatforms: PlatformInput[] = [
  {
    name: 'Groover Artist Promotion and Curator Marketplace Route',
    websiteUrl: 'https://groover.co/en/',
    submissionUrl: 'https://groover.co/en/',
    sourceUrl: 'https://groover.co/en/',
    sourceType: 'automation_run_17_public_research',
    country: 'France / United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'reggae', 'dubstep', 'playlist-pitching', 'radio-promotion', 'label-discovery'],
    submissionMethod: 'paid-credit-artist-to-curator-marketplace-needs-account-track-and-budget-review',
    feeRequired: true,
    feeAmount:
      'Public pricing states 1 Grooviz = €1 and curator/pro contacts generally start at 2 Grooviz, with some top-tier contacts costing more.',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Groover requires account/campaign setup, selected curators/pros, track or demo link, pitch text, credits and budget approval; MarcsMusic targeting should be manually reviewed before any paid submission.',
    notes:
      'Research verified Groover as an active global artist-promotion marketplace with 3,000+ curators/pros, electronic genre support, playlists, radio, labels, DJs and guaranteed-feedback mechanics. No signup, credit purchase, curator selection, track upload, payment or protected workflow was accessed.'
  },
  {
    name: 'Musosoup Curator Coverage and Campaign Submission Route',
    websiteUrl: 'https://musosoup.com/',
    submissionUrl: 'https://app.musosoup.com/',
    sourceUrl: 'https://musosoup.com/',
    sourceType: 'automation_run_17_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['all', 'electronic', 'house', 'techno', 'synthwave', 'playlisting', 'blogs', 'radio'],
    submissionMethod: 'artist-campaign-submission-with-editorial-review-account-and-campaign-fee-after-approval',
    feeRequired: true,
    feeAmount:
      'Public page states campaign activation starts from £42 after submission review, while initial upload/submission can start without upfront cost.',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Musosoup reviews submissions before account/campaign activation and then uses paid campaign setup plus optional paid/free curator offers; manual review is needed for release timing, track assets, curator offers and cost approval.',
    notes:
      'Research verified Musosoup as an active platform connecting independent artists with curators, playlists, press and radio across 120 countries and 200+ genres, including electronic, house, techno and synthwave. No account, upload, campaign activation, payment or offer acceptance was performed.'
  },
  {
    name: 'DailyPlaylists Spotify Playlist Submission Route',
    websiteUrl: 'https://dailyplaylists.com/',
    submissionUrl: 'https://dailyplaylists.com/submit-a-song',
    sourceUrl: 'https://dailyplaylists.com/',
    sourceType: 'automation_run_17_public_research',
    country: 'Global',
    language: 'en',
    genres: ['all', 'spotify-playlists', 'playlist-pitching', 'community-feedback'],
    submissionMethod: 'spotify-playlist-marketplace-with-free-standard-and-paid-premium-pro-tiers-needs-login-review',
    feeRequired: false,
    feeAmount: 'Standard submissions are advertised as free; premium/pro options and credits exist.',
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'DailyPlaylists requires sign-in/searching for the artist track and uses standard, premium and professional tiers; manual review is needed before connecting accounts, choosing playlists or spending premium credits.',
    notes:
      'Research verified DailyPlaylists as active with public submission links, 75M+ facilitated submissions, 500k+ artists, 18,000+ playlists and a visible public business email info@dailyplaylists.com. Email was syntax-observed only; no MX/SMTP probing or deliverability probing was performed.'
  },
  {
    name: 'Playlist Push Spotify and TikTok Promotion Campaign Route',
    websiteUrl: 'https://playlistpush.com/',
    submissionUrl: 'https://app.playlistpush.com/',
    sourceUrl: 'https://playlistpush.com/',
    sourceType: 'automation_run_17_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'spotify-playlists', 'tiktok', 'electronic', 'playlist-pitching', 'creator-campaigns'],
    submissionMethod: 'paid-spotify-playlist-and-tiktok-creator-campaign-route-needs-budget-and-targeting-review',
    feeRequired: true,
    feeAmount:
      'Public FAQ says Spotify campaigns typically start at $280; campaign pricing is flexible and goal-based.',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Playlist Push requires account creation, artist dashboard access, campaign brief, targeting, budget, Spotify/TikTok campaign selection and payment approval; no automatic campaign should be created.',
    notes:
      'Research verified Playlist Push as an active music-promotion service with Spotify playlist promotion, TikTok creator promotion, vetted curators, artist reviews, reporting dashboard and no-bots positioning. No account, campaign, targeting, payment or dashboard action was performed.'
  },
  {
    name: 'One Submit Independent Curator Promotion Route',
    websiteUrl: 'https://www.one-submit.com/',
    submissionUrl: 'https://app.one-submit.com/',
    sourceUrl: 'https://www.one-submit.com/',
    sourceType: 'automation_run_17_public_research',
    country: 'Global',
    language: 'en',
    genres: ['all', 'electronic', 'spotify-playlists', 'tiktok', 'youtube', 'blogs', 'radio', 'record-labels'],
    submissionMethod:
      'paid-independent-curator-campaign-for-playlists-video-blogs-radio-and-labels-needs-account-payment-review',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'One Submit requires artist account/campaign setup, track upload/link, campaign selection and payment; because it covers multiple curator classes and explicitly paid promotion, MarcsMusic targeting and budget must be approved manually.',
    notes:
      'Research verified One Submit as an active independent music promotion route advertising 2,200 curators, Spotify playlisters, TikTok influencers, YouTube channels, blogs, online radio, music magazines and record labels. No signup, upload, campaign selection or payment workflow was accessed.'
  },
  {
    name: 'Indiemono Free Playlist and Services Submission Route',
    websiteUrl: 'https://indiemono.com/',
    submissionUrl: 'https://indiemono.com/submit-music-chill-playlists/',
    sourceUrl: 'https://indiemono.com/submit-music-chill-playlists/',
    sourceType: 'automation_run_17_public_research',
    country: 'Spain / global playlist reach',
    language: 'en',
    genres: ['chill', 'edm', 'indie', 'alternative', 'urban', 'trap', 'rnb', 'latino', 'spotify-playlists'],
    submissionMethod:
      'free-public-spotify-track-url-form-with-consent-and-service-interest-fields-needs-manual-form-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Indiemono exposes a public form with consent terms, Spotify-track URL requirements and optional routing to PR/labels/radio/blogs/TikTok/sync interests; manual review is needed to choose the correct category and confirm consent.',
    notes:
      'Research verified Indiemono as an active free music-submission route with visible form fields for name, email, track name, Spotify URL, closest genre and territories. The page says it does not reply to email/Facebook submissions, so no business email route was used.'
  },
  {
    name: 'Spinnin Records Talent Pool Demo Submission Route',
    websiteUrl: 'https://spinninrecords.com/',
    submissionUrl: 'https://spinninrecords.com/talentpool/',
    sourceUrl: 'https://spinninrecords.com/talentpool/',
    sourceType: 'automation_run_17_public_research',
    country: 'Netherlands / global dance label community',
    language: 'en',
    genres: ['edm', 'dance', 'house', 'future-house', 'melodic-dance', 'demo-submission', 'remix-contests'],
    submissionMethod: 'label-talent-pool-demo-upload-route-requires-login-and-rights-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Spinnin Talent Pool requires account login to submit a demo and exposes rankings, latest additions and contests; manual review is needed for demo ownership, release status, SoundCloud/track link, contest terms and label fit.',
    notes:
      'Research verified Spinnin Records Talent Pool as active via public page showing login-to-submit prompt, most-popular chart, latest additions and current releases. No login, dashboard access, demo submission, contest entry or protected workflow was accessed.'
  },
  {
    name: 'Omari MC Music Submission and Licensing Split Route',
    websiteUrl: 'https://www.omarimc.com/',
    submissionUrl: 'https://www.omarimc.com/submit-your-music/',
    sourceUrl: 'https://www.omarimc.com/submit-your-music/',
    sourceType: 'automation_run_17_public_research',
    country: 'United States / global online promotion reach',
    language: 'en',
    genres: ['all', 'edm', 'future-bass', 'spotify-playlists', 'social-media-promotion', 'sync-licensing'],
    submissionMethod: 'public-music-submission-form-with-social-follow-requirement-and-captcha-needs-manual-review',
    loginRequired: false,
    captchaDetected: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Omari MC submission includes a social follow requirement, unreleased/released-song decision, song-link fields, explicit-content check, mailing-list option and CAPTCHA; because CAPTCHA and terms/requirements exist, this must stay manual.',
    notes:
      'Research verified Omari MC as active with public submit-music page, network/playlist/social promotion claims, streaming/sync licensing split language, EDM/Future Bass example, and visible form fields. No CAPTCHA solving, social follow action, form submission, upload or protected workflow was attempted.'
  }
];
