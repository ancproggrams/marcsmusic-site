export type QueueStatus = 'queued' | 'needs_manual_review';

export type SubmissionPlatform = {
  id: string;
  slug: string;
  name: string;
  category: string;
  country: string;
  submissionUrl: string;
  evidenceUrl: string;
  activityStatus: string;
  verificationStatus: string;
  queueStatus: QueueStatus;
  manualReviewReasons: string[];
  feeRequired: boolean;
  loginRequired: boolean;
  captchaDetected: boolean;
  paymentRequired: boolean;
  genreFit: string[];
  confidenceScore: number;
  priorityScore: number;
  notes: string;
  contacts: Array<{
    email: string;
    verification: string;
    roleAccount: boolean;
    syntaxValid: boolean;
    smtpProbePerformed: boolean;
    mxProbePerformed: boolean;
    deliverabilityScore: number;
  }>;
};

export const discoveredPlatforms: SubmissionPlatform[] = [
  {
    id: 'MSP-0001',
    slug: 'groover',
    name: 'Groover',
    category: 'curator marketplace',
    country: 'FR/US/global',
    submissionUrl: 'https://groover.co/en/',
    evidenceUrl: 'https://groover.co/en/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['payment_required', 'account_signup_required'],
    feeRequired: true,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: true,
    genreFit: ['Electronic', 'Reggae', 'Dance', 'World', 'Pop'],
    confidenceScore: 95,
    priorityScore: 90,
    notes:
      'Paid curator marketplace with broad genre coverage including electronic and reggae. Account and credits required.',
    contacts: []
  },
  {
    id: 'MSP-0002',
    slug: 'soundplate-play',
    name: 'Soundplate Play',
    category: 'playlist submission directory',
    country: 'UK/global',
    submissionUrl: 'https://play.soundplate.com/',
    evidenceUrl: 'https://play.soundplate.com/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'queued',
    manualReviewReasons: [],
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['House', 'Bass', 'Garage', 'Festival', 'Electronic'],
    confidenceScore: 92,
    priorityScore: 86,
    notes:
      'Free public playlist submission directory. Browser pass should map per-playlist form fields and enforce relevance/no-spam rules.',
    contacts: []
  },
  {
    id: 'MSP-0003',
    slug: 'dailyplaylists',
    name: 'DailyPlaylists',
    category: 'playlist submission marketplace',
    country: 'global',
    submissionUrl: 'https://dailyplaylists.com/',
    evidenceUrl: 'https://dailyplaylists.com/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['login_required'],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['Spotify playlists', 'Electronic', 'Pop', 'Reggae'],
    confidenceScore: 91,
    priorityScore: 84,
    notes: 'Free standard route exists, but sign-in is required before a safe workflow can continue.',
    contacts: [
      {
        email: 'info@dailyplaylists.com',
        verification: 'published_on_official_site_syntax_valid',
        roleAccount: true,
        syntaxValid: true,
        smtpProbePerformed: false,
        mxProbePerformed: false,
        deliverabilityScore: 65
      }
    ]
  },
  {
    id: 'MSP-0004',
    slug: 'musosoup',
    name: 'Musosoup',
    category: 'press and curator campaign marketplace',
    country: 'UK/global',
    submissionUrl: 'https://musosoup.com/',
    evidenceUrl: 'https://musosoup.com/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['manual_platform_review', 'payment_required_after_review', 'account_required_after_review'],
    feeRequired: true,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: true,
    genreFit: ['independent music', 'playlisting', 'radio', 'press'],
    confidenceScore: 90,
    priorityScore: 82,
    notes:
      'Initial upload can be free, but the platform reviews submissions and charges campaign fees after acceptance.',
    contacts: []
  },
  {
    id: 'MSP-0005',
    slug: 'playlist-push',
    name: 'Playlist Push',
    category: 'playlist and TikTok promotion marketplace',
    country: 'US/global',
    submissionUrl: 'https://playlistpush.com/',
    evidenceUrl: 'https://playlistpush.com/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['payment_required', 'account_signup_required'],
    feeRequired: true,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: true,
    genreFit: ['Spotify playlists', 'TikTok', 'Electronic', 'Pop'],
    confidenceScore: 88,
    priorityScore: 78,
    notes: 'Paid campaign route with vetted curators. Requires budget/campaign approval before use.',
    contacts: []
  },
  {
    id: 'MSP-0006',
    slug: 'spotify-for-artists-editorial-pitching',
    name: 'Spotify for Artists Editorial Pitching',
    category: 'DSP editorial pitch',
    country: 'global',
    submissionUrl: 'https://support.spotify.com/us/artists/article/pitching-music-to-playlist-editors/',
    evidenceUrl: 'https://support.spotify.com/us/artists/article/pitching-music-to-playlist-editors/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: [
      'login_required',
      'admin_or_editor_access_required',
      'unreleased_track_required',
      'one_song_at_a_time'
    ],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['official Spotify editorial', 'Release Radar'],
    confidenceScore: 98,
    priorityScore: 95,
    notes:
      'Official Spotify route. Requires Spotify for Artists access and an unreleased song delivered at least 7 days before release.',
    contacts: []
  },
  {
    id: 'MSP-0007',
    slug: 'armada-music-demo-drop',
    name: 'Armada Music Demo Drop',
    category: 'record label demo submission',
    country: 'NL/global',
    submissionUrl: 'https://www.armadamusic.com/',
    evidenceUrl: 'https://www.armadamusic.com/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'queued',
    manualReviewReasons: [],
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['EDM', 'trance', 'progressive', 'house', 'deep house', 'techno'],
    confidenceScore: 86,
    priorityScore: 83,
    notes: 'Official homepage exposes a Demo drop route. Browser pass should capture fields before any submission.',
    contacts: []
  },
  {
    id: 'MSP-0008',
    slug: 'ncs-labelradar',
    name: 'NCS Demo Submissions via LabelRadar',
    category: 'record label demo submission',
    country: 'UK/global',
    submissionUrl: 'https://www.labelradar.com/labels/ncs/portal',
    evidenceUrl: 'https://ncs.io/contact',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['third_party_platform', 'possible_login_required'],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['Electronic', 'Bass', 'Drum & Bass', 'Dubstep', 'Melodic Dubstep', 'Future Bass'],
    confidenceScore: 93,
    priorityScore: 88,
    notes:
      'NCS official contact page routes demo submissions through LabelRadar. LabelRadar likely requires account workflow.',
    contacts: []
  },
  {
    id: 'MSP-0009',
    slug: 'channel-r-rising',
    name: 'Channel R Rising Artist Submit',
    category: 'radio emerging artist submission',
    country: 'US/global',
    submissionUrl: 'https://channelrradio.com/rising/',
    evidenceUrl: 'https://channelrradio.com/rising/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route',
    queueStatus: 'queued',
    manualReviewReasons: [],
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['emerging artists', 'indie', 'unsigned', 'pop/electronic crossover'],
    confidenceScore: 89,
    priorityScore: 80,
    notes:
      'Daily emerging-artist show with an Artist Submit link. Browser pass should capture external form fields safely.',
    contacts: []
  },
  {
    id: 'MSP-0010',
    slug: 'monstercat',
    name: 'Monstercat',
    category: 'electronic record label',
    country: 'CA/global',
    submissionUrl: 'https://www.monstercat.com/',
    evidenceUrl: 'https://www.monstercat.com/',
    activityStatus: 'active',
    verificationStatus: 'verified_platform_activity_no_public_submit_confirmed',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['no_public_submission_route_confirmed', 'contact_or_a_and_r_route_required'],
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['Electronic', 'Uncaged', 'Instinct', 'Silk', 'Dubstep', 'Bass'],
    confidenceScore: 72,
    priorityScore: 76,
    notes: 'Active electronic label with recent releases, but a public authorized demo route was not confirmed.',
    contacts: []
  },
  {
    id: 'MSP-0011',
    slug: 'bbc-music-introducing',
    name: 'BBC Music Introducing',
    category: 'public broadcaster emerging artist upload',
    country: 'UK',
    submissionUrl: 'https://www.bbc.co.uk/introducing',
    evidenceUrl: 'https://www.bbc.co.uk/introducing',
    activityStatus: 'active',
    verificationStatus: 'secondary_source_verified',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['uk_postcode_required', 'account_required', 'region_restricted'],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['new music', 'electronic', 'unsigned'],
    confidenceScore: 78,
    priorityScore: 66,
    notes: 'BBC Introducing upload platform is active but region/account constraints make this manual-review only.',
    contacts: []
  },
  {
    id: 'MSP-0012',
    slug: 'submit-hub',
    name: 'SubmitHub',
    category: 'curator submission marketplace',
    country: 'global',
    submissionUrl: 'https://www.submithub.com/',
    evidenceUrl: 'https://www.submithub.com/',
    activityStatus: 'unknown_this_run',
    verificationStatus: 'homepage_opened_no_parseable_text',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['verification_incomplete', 'login_or_payment_likely_required'],
    feeRequired: true,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: true,
    genreFit: ['curators', 'blogs', 'playlists'],
    confidenceScore: 60,
    priorityScore: 70,
    notes: 'Kept as manual-review candidate because current page text could not be parsed reliably in this run.',
    contacts: []
  },
  {
    id: 'MSP-0013',
    slug: 'earmilk',
    name: 'EARMILK',
    category: 'music publication and curator submission route',
    country: 'US/global',
    submissionUrl: 'https://earmilk.com/submit-music/',
    evidenceUrl: 'https://earmilk.com/submit-music/',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route_third_party_only',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['third_party_submission_platform', 'submithub_or_pillargram_required', 'account_or_payment_status_requires_manual_check'],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['Dance', 'Electronic', 'Experimental', 'Indie', 'Pop', 'Reggae'],
    confidenceScore: 91,
    priorityScore: 82,
    notes:
      'Official submit page says music and premiere submissions are accepted only through SubmitHub or Pillargram; contact form submissions are filtered.',
    contacts: [
      {
        email: 'david@earmilk.com',
        verification: 'published_on_official_contact_page_brand_partnership_not_music_submission_syntax_valid',
        roleAccount: false,
        syntaxValid: true,
        smtpProbePerformed: false,
        mxProbePerformed: false,
        deliverabilityScore: 70
      }
    ]
  },
  {
    id: 'MSP-0014',
    slug: 'pillargram',
    name: 'Pillargram',
    category: 'curator marketplace and submission platform',
    country: 'global',
    submissionUrl: 'https://pillargram.com/',
    evidenceUrl: 'https://pillargram.com/refer-curator?referCode=EARMILK',
    activityStatus: 'active',
    verificationStatus: 'verified_public_route_account_required',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['account_signup_required', 'email_verification_required', 'pricing_needs_manual_review'],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['curator feedback', 'promotion', 'industry exposure', 'blogs', 'playlists'],
    confidenceScore: 86,
    priorityScore: 76,
    notes:
      'Referral page exposes a public music submission route, but it requires account creation and email verification before continuing.',
    contacts: []
  },
  {
    id: 'MSP-0015',
    slug: 'triple-j-unearthed',
    name: 'triple j Unearthed',
    category: 'public broadcaster emerging artist platform',
    country: 'AU',
    submissionUrl: 'https://www.abc.net.au/triplejunearthed',
    evidenceUrl: 'https://www.abc.net.au/triplejunearthed',
    activityStatus: 'active',
    verificationStatus: 'verified_platform_activity_manual_eligibility_required',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['account_required', 'australia_artist_eligibility', 'region_restricted'],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['Electronic', 'Dance', 'Pop', 'Beats', 'Indie', 'Experimental'],
    confidenceScore: 90,
    priorityScore: 68,
    notes:
      'Active Australian emerging-artist platform with recent staff reviews and electronic/dance coverage, but eligibility and account requirements make it manual-only.',
    contacts: []
  },
  {
    id: 'MSP-0016',
    slug: 'amazing-radio',
    name: 'Amazing Radio',
    category: 'radio platform for emerging artists',
    country: 'UK/US/global',
    submissionUrl: 'https://amazingradio.com/',
    evidenceUrl: 'https://amazingradio.com/',
    activityStatus: 'active_but_submission_route_not_mapped_this_run',
    verificationStatus: 'secondary_source_verified_submission_claim_official_page_not_parseable',
    queueStatus: 'needs_manual_review',
    manualReviewReasons: ['official_form_not_parseable', 'account_or_upload_login_likely', 'browser_mapping_required'],
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    genreFit: ['emerging artists', 'independent music', 'electronic', 'indie', 'pop', 'alternative'],
    confidenceScore: 67,
    priorityScore: 63,
    notes:
      'Secondary source states artists can submit via the Amazing Radio website. Official page could not be parsed in this run, so keep manual until a safe route is mapped.',
    contacts: []
  }
];
