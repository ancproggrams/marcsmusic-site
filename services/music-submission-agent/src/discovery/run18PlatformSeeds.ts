import type { PlatformInput } from '../models/types.js';

export const run18SeedPlatforms: PlatformInput[] = [
  {
    name: 'SubmitHub Global Curator and Blog Submission Marketplace Route',
    websiteUrl: 'https://www.submithub.com/',
    submissionUrl: 'https://www.submithub.com/',
    sourceUrl: 'https://www.submithub.com/',
    sourceType: 'automation_run_18_public_research',
    country: 'Global',
    language: 'en',
    genres: ['all', 'electronic', 'edm', 'dubstep', 'reggae', 'blogs', 'spotify-playlists', 'radio', 'record-labels'],
    submissionMethod:
      'artist-to-curator-marketplace-with-standard-or-premium-submission-paths-needs-account-and-targeting-review',
    feeRequired: false,
    feeAmount:
      'Free or standard routes may exist depending on curator; premium credit-based submissions are also part of the marketplace.',
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Requires account access, track metadata, curator selection and possible paid-credit decisions; MarcsMusic targeting, budget and pitch copy should be manually reviewed before submission.',
    notes:
      'Verified as an active route because multiple active publication pages route their submissions through SubmitHub. No signup, account access, curator selection, credit purchase, upload, payment or protected workflow was attempted.'
  },
  {
    name: 'A&R Factory Submit Demo and Independent Music Blog Route',
    websiteUrl: 'https://www.anrfactory.com/',
    submissionUrl: 'https://www.anrfactory.com/submit-demo/',
    sourceUrl: 'https://www.anrfactory.com/submit-demo/',
    sourceType: 'automation_run_18_public_research',
    country: 'United Kingdom / global readership',
    language: 'en',
    genres: ['all', 'dance', 'edm', 'drum-and-bass', 'electronic', 'house', 'reggae', 'synthwave', 'techno', 'trap'],
    submissionMethod: 'public-three-step-music-review-form-with-free-standard-and-premium-package-options',
    feeRequired: false,
    feeAmount: 'Public form lists Free Submission, Standard Submission £20 and Premium Donation Submission £30.',
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The public form requires artist details, track URL, release status/date, socials, artwork/photo, EPK/bio, consent, budget range and package selection; paid options and consent language require human review.',
    notes:
      'Verified active 2026 posting and a public submission form with EDM, drum and bass, electronic, house, reggae, synthwave, techno and trap genre options. No form submission, payment, card action or protected workflow was performed.'
  },
  {
    name: 'Neon Music SubmitHub and Bliiink Submission Route',
    websiteUrl: 'https://neonmusic.co.uk/',
    submissionUrl: 'https://neonmusic.co.uk/submit-music',
    sourceUrl: 'https://neonmusic.co.uk/submit-music',
    sourceType: 'automation_run_18_public_research',
    country: 'United Kingdom / global online reach',
    language: 'en',
    genres: ['all', 'pop', 'electronic', 'independent-music', 'reviews', 'music-discovery'],
    submissionMethod: 'publication-submission-route-via-submithub-or-bliiink-needs-third-party-marketplace-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Routes submissions through SubmitHub and Bliiink, which require third-party marketplace/account handling, possible credit/payment choices and pitch/track targeting.',
    notes:
      'Verified active 2026 editorial posts and a public Submit Music page pointing artists to SubmitHub and Bliiink. No marketplace login, account connection, payment, upload or protected submission workflow was accessed.'
  },
  {
    name: 'Elicit Magazine Submit Music Press and Feature Route',
    websiteUrl: 'https://www.elicitmagazine.com/',
    submissionUrl: 'https://www.elicitmagazine.com/submit-press/',
    sourceUrl: 'https://www.elicitmagazine.com/submit-press/',
    sourceType: 'automation_run_18_public_research',
    country: 'United States / global online reach',
    language: 'en',
    genres: ['all', 'press-release', 'music-news', 'music-reviews', 'artist-features'],
    submissionMethod: 'public-press-release-form-and-published-feature-contact-needs-manual-copy-and-rights-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    captchaDetected: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Requires a press release, song URL, post title, file upload sizing rules, human anti-spam question and at least 500 words; manual editorial and rights review is needed.',
    notes:
      'Verified active 2026 content, a public Submit Music Press form and a published feature-contact route. Public contact was syntax-observed only; no deliverability probing, file upload or form submission was performed.'
  },
  {
    name: 'Stereo Stickman Independent Artist Review and Interview Route',
    websiteUrl: 'https://stereostickman.com/',
    submissionUrl: 'https://stereostickman.com/contact/',
    sourceUrl: 'https://stereostickman.com/contact/',
    sourceType: 'automation_run_18_public_research',
    country: 'United Kingdom / global online reach',
    language: 'en',
    genres: [
      'all',
      'dance',
      'edm',
      'electronica',
      'house',
      'trap',
      'reggae',
      'independent-music',
      'interviews',
      'reviews'
    ],
    submissionMethod: 'paid-review-interview-and-general-enquiry-form-needs-service-selection-and-payment-review',
    feeRequired: true,
    feeAmount:
      'Public contact page lists track review $20, EP review $40, album review $50, premium package $65 and interview options from $20-$30.',
    loginRequired: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Exposes service/package choices and paid review/interview options; manual review is required before selecting a service, providing track links, approving spend or authorizing publication.',
    notes:
      'Verified as active independent music magazine with visible genre coverage including Dance, EDM, Electronica, House, Trap and Reggae, plus a public contact/order form. No order, payment, track submission or form submission was performed.'
  },
  {
    name: 'FLEX Music Blog Independent Music Contact Submission Route',
    websiteUrl: 'https://www.flexmusicblog.com/',
    submissionUrl: 'https://www.flexmusicblog.com/',
    sourceUrl: 'https://www.flexmusicblog.com/',
    sourceType: 'automation_run_18_public_research',
    country: 'United Kingdom / global online reach',
    language: 'en',
    genres: ['all', 'independent-music', 'new-music', 'features', 'interviews', 'reviews'],
    submissionMethod: 'public-contact-form-route-visible-on-active-independent-music-blog-needs-manual-form-mapping',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The page shows an active independent-music publication and a contact submission section, but the full form fields were not safely parseable; manual review is required before entering release data.',
    notes:
      'Verified active June 2026 posts and a visible Contact section with submission confirmation text. No form interaction, hidden-field inference, contact guessing or protected workflow was performed.'
  },
  {
    name: 'Right Chord Music Free Music Blog Submission Route',
    websiteUrl: 'https://www.rightchordmusic.co.uk/',
    submissionUrl: 'https://www.rightchordmusic.com/',
    sourceUrl: 'https://www.rightchordmusic.com/',
    sourceType: 'automation_run_18_public_research',
    country: 'United Kingdom / global independent-artist reach',
    language: 'en',
    genres: ['all', 'independent-music', 'music-blogs', 'new-music', 'spotify-playlists', 'music-reviews'],
    submissionMethod: 'free-independent-music-blog-network-submission-route-needs-third-party-flow-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Advertises free blog submissions and routes discovery through its RCM Indie Collective or Major Labl flow; manual review is needed before using the external submit flow or sharing release metadata.',
    notes:
      'Verified active June 2026 posts and a public free music blog submissions page stating submissions are shared with 20+ writers and that it is free to submit to Right Chord Music and the RCM Indie Collective. No external form, account, contact database access or submission was used.'
  },
  {
    name: 'RDFO Blog Review and Records Demo Submission Route',
    websiteUrl: 'https://www.rockdafuqout.com/',
    submissionUrl: 'https://www.rockdafuqout.com/',
    sourceUrl: 'https://www.rockdafuqout.com/',
    sourceType: 'automation_run_18_public_research',
    country: 'United States / global online reach',
    language: 'en',
    genres: ['all', 'electronic', 'pop', 'indie', 'hip-hop', 'reggae', 'reviews', 'label-demo'],
    submissionMethod: 'blog-review-submithub-route-plus-public-demo-contact-needs-manual-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Uses a SubmitHub blog-review route and publishes demo contact instructions for records activity; manual review is needed for label/demo fit, unreleased rights, pitch copy and whether to use marketplace or contact routing.',
    notes:
      'Verified active 2026 posts, electronic/reggae-relevant coverage, an official Submit to Our Blog link to SubmitHub and public demo contact instructions. Public contact was syntax-observed only; no deliverability probing, message send, SubmitHub login or form submission was performed.'
  }
];
