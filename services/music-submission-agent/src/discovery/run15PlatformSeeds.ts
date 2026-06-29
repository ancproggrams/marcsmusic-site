import type { PlatformInput } from '../models/types.js';

export const run15SeedPlatforms: PlatformInput[] = [
  {
    name: 'LabelWorx Electronic Label Distribution and Promo Route',
    websiteUrl: 'https://labelworx.com/',
    submissionUrl: 'https://labelworx.com/signup',
    sourceUrl: 'https://labelworx.com/signup',
    sourceType: 'automation_run_15_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['electronic', 'house', 'techno', 'dance', 'bass', 'independent-labels'],
    submissionMethod: 'electronic-label-distribution-promo-and-royalty-services-signup-needs-manual-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'LabelWorx reviews every signup request personally and the workflow requires service selection, legal details, label/artist context and rights review before any MarcsMusic material can be routed.',
    notes:
      'Research verified LabelWorx as an active independent digital distribution partner for indie electronic labels with distribution, promo, royalty tools and a public signup form. No signup, login, form submission or protected workflow was accessed.'
  },
  {
    name: 'iGroove Distribution Marketing and Financing Route',
    websiteUrl: 'https://www.igroovemusic.com/',
    submissionUrl: 'https://www.igroovemusic.com/',
    sourceUrl: 'https://www.igroovemusic.com/',
    sourceType: 'automation_run_15_public_research',
    country: 'Switzerland / global',
    language: 'en',
    genres: ['all', 'electronic', 'independent', 'distribution', 'playlist-pitching', 'marketing'],
    submissionMethod: 'account-based-distribution-marketing-and-playlist-pitching-route-needs-rights-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'iGroove requires signup/account onboarding, release creation, contracts, marketing-service booking and rights/royalty setup; those steps need manual review before use.',
    notes:
      'Research verified iGroove as an active music-business platform with worldwide distribution, release creation, money splits, marketing services, playlist pitching and account signup/login. No account, release setup, contract workflow or protected page was accessed.'
  },
  {
    name: 'AirPlay Direct Global Radio Promotion Route',
    websiteUrl: 'https://airplaydirect.com/',
    submissionUrl: 'https://airplaydirect.com/',
    sourceUrl: 'https://airplaydirect.com/',
    sourceType: 'automation_run_15_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'radio-promotion', 'electronic', 'independent', 'dpks'],
    submissionMethod: 'radio-promotion-digital-press-kit-route-needs-account-and-payment-review',
    feeRequired: true,
    feeAmount: 'Free trial advertised; paid artist accounts shown at $100-$300/year and label accounts contact-for-pricing.',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'AirPlay Direct promotes releases to global radio tastemakers but requires artist signup, account-plan selection, DPK/release configuration and likely payment after trial; no automatic outreach should run until campaign scope and costs are approved.',
    notes:
      'Research verified AirPlay Direct as an active global radio distribution and promotion route with artist signup, radio partners, account tiers and DPK functionality. No signup, payment, upload or protected workflow was accessed.'
  },
  {
    name: 'Inflyte Promo Delivery and Tastemaker Campaign Route',
    websiteUrl: 'https://www.inflyteapp.com/',
    submissionUrl: 'https://www.inflyteapp.com/',
    sourceUrl: 'https://www.inflyteapp.com/',
    sourceType: 'automation_run_15_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['electronic', 'dance', 'dj-promo', 'radio-promotion', 'playlist-monitoring', 'pre-saves'],
    submissionMethod: 'paid-promo-delivery-and-tastemaker-campaign-route-needs-manual-review',
    feeRequired: true,
    feeAmount: 'Pay-as-you-go and monthly promo plans advertised in GBP.',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Inflyte campaign delivery requires plan choice, payment, contact targeting, asset upload and sender/list compliance review before any MarcsMusic promo campaign can be created.',
    notes:
      'Research verified Inflyte as an active promo engine for labels, agencies and artists with DJ/tastemaker delivery, pre-saves, airplay monitoring, pricing and a contact/start form. No account, Stripe/PayPal payment, campaign upload or protected workflow was accessed.'
  },
  {
    name: 'HAULIX Music Promotion and Media Connect Route',
    websiteUrl: 'https://haulix.com/',
    submissionUrl: 'https://haulix.com/',
    sourceUrl: 'https://haulix.com/',
    sourceType: 'automation_run_15_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'music-promotion', 'press', 'media', 'labels', 'electronic'],
    submissionMethod: 'secure-promo-page-and-media-connect-route-needs-account-and-payment-review',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'HAULIX requires sender/listener account flow, pricing/signup, promo-page setup, contact-list targeting and rights/security review before a release can be promoted.',
    notes:
      'Research verified HAULIX as an active secure music-promotion platform for artists, labels and publicists with promo pages, release uploads, curated contact lists and pricing/signup. No account, signup, upload, payment or protected workflow was accessed.'
  },
  {
    name: 'ZIPDJ Artist and Label Music Submission Route',
    websiteUrl: 'https://www.zipdj.com/',
    submissionUrl: 'https://www.zipdj.com/music-submission',
    sourceUrl: 'https://www.zipdj.com/music-submission',
    sourceType: 'automation_run_15_public_research',
    country: 'Canada / global',
    language: 'en',
    genres: ['electronic', 'house', 'techno', 'bass', 'drum and bass', 'dubstep', 'trance', 'afro-house'],
    submissionMethod: 'public-mp3-upload-form-for-dj-pool-review-needs-terms-and-asset-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'ZIPDJ exposes a public music uploader, but it requires MP3/ZIP assets, agreement to submission terms and up to 48-hour review; terms and rights must be manually accepted before any upload.',
    notes:
      'Research verified ZIPDJ as an active DJ pool with artist/label submission fields for email, artist, title, music upload and agreement plus broad electronic genre coverage. No upload, terms acceptance or form submission was performed.'
  },
  {
    name: 'Kudos Distribution Independent Label Apply Route',
    websiteUrl: 'https://kudosrecords.co.uk/',
    submissionUrl: 'https://kudosrecords.co.uk/apply/',
    sourceUrl: 'https://kudosrecords.co.uk/apply/',
    sourceType: 'automation_run_15_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['independent-labels', 'electronic', 'jazz', 'downtempo', 'physical-distribution', 'digital-distribution'],
    submissionMethod: 'curated-independent-label-distribution-application-needs-manual-review',
    loginRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Kudos works with a hand-picked selection of independent labels and the apply route loads a JavaScript-dependent application; label fit, catalogue scope, P&D/digital terms and rights must be reviewed manually.',
    notes:
      'Research verified Kudos as an active independent UK distributor with physical and digital distribution, playlist pitching, label portal tools and an apply route. No JavaScript form execution, application submission, account access or protected workflow was attempted.'
  },
  {
    name: 'Republic of Music Distribution Label Services and Sync Contact Route',
    websiteUrl: 'https://www.republicofmusic.net/',
    submissionUrl: 'https://www.republicofmusic.net/contact',
    sourceUrl: 'https://www.republicofmusic.net/contact',
    sourceType: 'automation_run_15_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['all', 'independent-labels', 'electronic', 'sync', 'publishing', 'physical-distribution', 'digital-distribution'],
    submissionMethod: 'distribution-label-services-sync-contact-form-needs-manual-review',
    loginRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Republic of Music offers distribution, label services, publishing, manufacturing and sync contact routing, but service selection, rights, catalogue fit and deal terms must be manually reviewed before outreach.',
    notes:
      'Research verified Republic of Music as an active independent music distribution and label-services company with a public contact route and service categories for Distribution, Label Management, Sync, Label Services, Publishing and Manufacturing. No form submission, login or protected workflow was accessed.'
  }
];
