import type { PlatformInput } from '../models/types.js';

export const run36SeedPlatforms: PlatformInput[] = [
  {
    name: 'Sofar Sounds Artist Application',
    websiteUrl: 'https://www.sofarsounds.com/',
    submissionUrl: 'https://www.sofarsounds.com/about/artists',
    sourceUrl: 'https://www.sofarsounds.com/about/artists',
    sourceType: 'automation_run_36_public_research',
    country: 'Global / 400+ cities / intimate live performance and artist discovery network',
    language: 'en',
    genres: [
      'live-performance',
      'electronic',
      'pop',
      'indie',
      'hip-hop',
      'singer-songwriter',
      'world',
      'acoustic',
      'showcase',
      'artist-discovery'
    ],
    submissionMethod: 'official-public-artist-application-with-account-dashboard-after-acceptance',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Sofar accepts artist applications for shows in more than 400 cities, but the workflow links to first-show/application actions, account/dashboard steps and anti-bot/cookie controls; performance fit, city availability, rights, live-set suitability and profile copy require manual owner review.',
    notes:
      'Official Sofar artist page says artists can submit an application, become eligible to play Sofar shows in unique venues in more than 400 cities worldwide and manage availability from an Artist Dashboard after acceptance. The page exposes hCaptcha/Cloudflare/BotManager and Stripe-related controls, so no automated application was attempted.'
  },
  {
    name: 'Unsigned Only Music Awards Online Entry',
    websiteUrl: 'https://unsignedonly.com/',
    submissionUrl: 'https://unsignedonly.com/enter',
    sourceUrl: 'https://unsignedonly.com/rules',
    sourceType: 'automation_run_36_public_research',
    country: 'Global / online music awards for unsigned and independent artists',
    language: 'en',
    genres: [
      'edm',
      'pop',
      'hip-hop',
      'rap',
      'r-and-b',
      'global-music',
      'instrumental',
      'music-video',
      'sync',
      'songwriting'
    ],
    submissionMethod: 'official-public-online-entry-or-mail-entry-with-mp3-upload-or-streaming-link',
    feeRequired: true,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Unsigned Only is open worldwide but requires paid entry fees, category selection, eligibility review for unsigned status, original/cover-song category handling and AI-policy review; payment and owner approval are mandatory before any submission.',
    notes:
      'Official Unsigned Only enter page allows online entry via MP3 upload or streaming link and mail entry. Rules list 2026 fees, worldwide eligibility, ownership retention and AI-performance restrictions. Public business email info@unsignedonly.com appears only for payment/bank-transfer questions and remains pending runtime Mailgun/SMTP validation.'
  },
  {
    name: 'Great American Song Contest 2026 Online Submission',
    websiteUrl: 'https://www.greatamericansong.com/',
    submissionUrl: 'https://www.greatamericansong.com/Form-Prepage.php',
    sourceUrl: 'https://www.greatamericansong.com/rules.php',
    sourceType: 'automation_run_36_public_research',
    country: 'Global / songwriting, lyric and composition contest',
    language: 'en',
    genres: [
      'songwriting',
      'lyrics',
      'composition',
      'pop',
      'hip-hop',
      'r-and-b',
      'rock',
      'folk',
      'instrumental',
      'electronic'
    ],
    submissionMethod: 'official-public-online-song-upload-form-with-paypal-payment',
    feeRequired: true,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Great American Song Contest is open worldwide but requires paid entry, MP3/upload constraints, PayPal payment, category/rights/AI-authorship checks and owner approval; the route cannot be queued for auto-submit.',
    notes:
      'Official site says the contest is open for 2026, permits online entries, prefers MP3 under 10MB, redirects to secure PayPal after upload and states writers retain all rights. Rules show a November 18, 2026 deadline, $40 classic entry fee and AI-authorship policy.'
  },
  {
    name: 'John Lennon Songwriting Contest 2026 Session Entry',
    websiteUrl: 'https://www.jlsc.com/',
    submissionUrl: 'https://apps.jlsc.com/register.php',
    sourceUrl: 'https://www.jlsc.com/about.php',
    sourceType: 'automation_run_36_public_research',
    country: 'Global / international songwriting contest with 12 categories',
    language: 'en',
    genres: [
      'electronic',
      'world',
      'latin',
      'hip-hop',
      'pop',
      'rock',
      'jazz',
      'r-and-b',
      'folk',
      'songwriting'
    ],
    submissionMethod: 'official-public-registration-credit-purchase-and-mp3-aac-upload-workflow',
    feeRequired: true,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'JLSC requires account registration, email activation, credit purchase, MP3/AAC upload, lyric sheet and payment; deadlines/categories/rights/eligibility require owner review and cannot be automated.',
    notes:
      'Official JLSC page shows 2026 Session I open through June 30, 2026 11:59pm PST and Session II opening July 1, 2026; registration page lists register, email activation, buy credits and upload MP3/AAC steps. About page lists 12 categories, upload limits and $30 per song payment.'
  },
  {
    name: 'Subvert Founding Artist or Label Membership',
    websiteUrl: 'https://subvert.fm/',
    submissionUrl: 'https://subvert.fm/',
    sourceUrl: 'https://subvert.fm/',
    sourceType: 'automation_run_36_public_research',
    country: 'Global / collectively owned music marketplace and member platform',
    language: 'en',
    genres: [
      'independent-music',
      'electronic',
      'labels',
      'artist-platform',
      'direct-to-fan',
      'marketplace',
      'community-owned',
      'catalog-upload',
      'music-tech'
    ],
    submissionMethod: 'official-public-free-artist-label-membership-and-members-only-alpha-route',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Subvert is a free artist/label membership route into a private/members-only alpha platform; Typeform/member onboarding, mailing-address data, platform readiness and catalog/listing policy require manual approval before queueing any upload or profile action.',
    notes:
      'Official Subvert page describes a community-owned music platform, live members-only alpha, free musician/label founding membership and phased opening during 2026. The artist/label join route is Typeform-based; no form was submitted and no account was created.'
  }
];
