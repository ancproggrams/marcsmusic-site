import type { PlatformInput } from '../models/types.js';

export const run16SeedPlatforms: PlatformInput[] = [
  {
    name: 'LabelRadar Demo Submission and Label Discovery Route',
    websiteUrl: 'https://www.labelradar.com/',
    submissionUrl: 'https://www.labelradar.com/',
    sourceUrl: 'https://greenroom.beatport.com/labels/labelradar',
    sourceType: 'automation_run_16_public_research',
    country: 'Global / Beatport ecosystem',
    language: 'en',
    genres: ['electronic', 'dance', 'bass', 'dubstep', 'house', 'trance', 'demo-submission'],
    submissionMethod: 'demo-submission-platform-for-artists-and-labels-needs-account-and-rights-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'LabelRadar connects artists with active labels and demo pipelines, but the route requires account access, demo upload, label selection, unreleased-track rights and platform terms review before MarcsMusic material can be submitted.',
    notes:
      'Research verified LabelRadar through Beatport Greenroom as an active demo-submission and label-discovery route with 300k+ artists and 3.6k+ labels. No login, upload, label submission, terms acceptance or protected workflow was accessed.'
  },
  {
    name: 'Beatport Greenroom Artist and Label Opportunities Route',
    websiteUrl: 'https://greenroom.beatport.com/',
    submissionUrl: 'https://greenroom.beatport.com/',
    sourceUrl: 'https://greenroom.beatport.com/',
    sourceType: 'automation_run_16_public_research',
    country: 'United States / Germany / global',
    language: 'en',
    genres: ['electronic', 'house', 'techno', 'drum and bass', 'dubstep', 'dance', 'dj-store'],
    submissionMethod: 'beatport-artist-label-opportunity-hub-needs-distributor-label-or-partner-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Beatport Greenroom exposes artist and label opportunities, including distribution partners, demo management, Hype, promotion and editorial tools; route choice depends on whether MarcsMusic is acting as artist, label or distributor and needs manual rights/distributor review.',
    notes:
      'Research verified Beatport Greenroom as an active support hub for artists and labels with 100k+ artists, 120k+ labels, global DJ reach and products including LabelRadar, Hype and Ampsuite. No signup, partner onboarding, distribution, Hype application, store pitch or protected workflow was accessed.'
  },
  {
    name: 'DropTrack Music Promotion and Industry Contact Campaign Route',
    websiteUrl: 'https://www.droptrack.com/',
    submissionUrl: 'https://cloud.droptrack.com/signup/artist',
    sourceUrl: 'https://www.droptrack.com/',
    sourceType: 'automation_run_16_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dj-promo', 'playlist-pitching', 'radio-promotion', 'blog-pitching'],
    submissionMethod:
      'artist-signup-promotion-and-targeted-industry-submission-route-needs-account-and-campaign-review',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'DropTrack requires account creation, campaign setup, contact-list selection, promo-copy/asset upload and possibly paid promotion/playlist placement; targeting and costs must be approved manually.',
    notes:
      'Research verified DropTrack as an active platform for independent artists and labels to pitch DJs, labels, playlist curators, blogs and radio with analytics and contact lists. No signup, upload, AI analyzer, campaign send, contact export, payment or protected workflow was accessed.'
  },
  {
    name: 'Promoly DJ Promo and Tastemaker Network Route',
    websiteUrl: 'https://promoly.com/',
    submissionUrl: 'https://mailer.promo.ly/',
    sourceUrl: 'https://promoly.com/',
    sourceType: 'automation_run_16_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['electronic', 'dance', 'dj-promo', 'blog-pitching', 'record-labels', 'publicists'],
    submissionMethod: 'dj-promo-mailout-and-tastemaker-network-route-needs-account-and-campaign-review',
    feeRequired: true,
    feeAmount: '7-day free trial advertised; paid plan likely required after free allowance for continued campaigns.',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Promoly requires account/trial access, track upload, campaign type, contact or Tastemaker Network targeting, promo text and send approval; the free-trial and paid-plan boundary must be reviewed manually.',
    notes:
      'Research verified Promoly as an active music-promo platform for labels, artists, publicists and DJs with upload, DJ mailouts, feedback tracking, smartlinks, pre-saves and 1,300+ opt-in DJs. No signup, trial start, upload, campaign send, contact targeting or payment workflow was accessed.'
  },
  {
    name: 'Play MPE Caster Global Radio Promotion Route',
    websiteUrl: 'https://www.plaympe.com/',
    submissionUrl: 'https://caster.plaympe.com/',
    sourceUrl: 'https://www.plaympe.com/',
    sourceType: 'automation_run_16_public_research',
    country: 'Canada / United States / global',
    language: 'en',
    genres: ['all', 'radio-promotion', 'media', 'music-supervision', 'curators', 'independent-artists'],
    submissionMethod: 'global-radio-and-industry-promotion-campaign-route-needs-payment-and-metadata-review',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Play MPE Caster requires mastered WAV/AIFF assets, artwork, ISRC/publishing metadata, target-market package selection and likely payment or sales onboarding before radio delivery.',
    notes:
      'Research verified Play MPE as an active platform for radio promoters, labels, managers and artists to upload mastered releases, build promotion campaigns and distribute to verified music industry contacts worldwide. No sign-in, get-started flow, upload, campaign build, package selection or protected workflow was accessed.'
  },
  {
    name: 'AirplayAccess Radio Programmer Delivery Route',
    websiteUrl: 'https://airplayaccess.com/',
    submissionUrl: 'https://airplayaccess.com/submit-my-music-to-radio/',
    sourceUrl: 'https://airplayaccess.com/',
    sourceType: 'automation_run_16_public_research',
    country: 'United States / worldwide radio reach',
    language: 'en',
    genres: ['all', 'radio-promotion', 'spotify-playlist-placement', 'commercial-radio', 'internet-radio'],
    submissionMethod: 'paid-upload-to-radio-programmer-delivery-route-needs-payment-and-rights-review',
    feeRequired: true,
    feeAmount:
      'Express $249 for 1 song / 1 radio format; Music Industry VIP $498 for 1 song / 2 radio formats plus Spotify placement shown publicly.',
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'AirplayAccess exposes upload and pricing routes, but music delivery to radio programmers requires payment, release metadata, service-format selection, rights confirmation and campaign approval.',
    notes:
      'Research verified AirplayAccess as an active radio-servicing platform with public Submit My Music route, pricing tiers, radio-programmer delivery, download tracking, announcements and STS integration. No upload, payment, account access, invoice, radio servicing or protected workflow was accessed.'
  },
  {
    name: 'MusicHub Distribution and Beatport Partner Route',
    websiteUrl: 'https://www.music-hub.com/',
    submissionUrl: 'https://app.music-hub.com/register',
    sourceUrl: 'https://www.music-hub.com/',
    sourceType: 'automation_run_16_public_research',
    country: 'Germany / Europe / global DSP reach',
    language: 'en',
    genres: ['all', 'electronic', 'distribution', 'beatport-distribution', 'independent-artists'],
    submissionMethod: 'account-based-digital-distribution-and-beatport-delivery-route-needs-registration-review',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'MusicHub requires registration/login, release setup, distribution terms, territory/store selection, metadata and rights review; Beatport delivery is relevant for MarcsMusic but should not be auto-submitted.',
    notes:
      'Research verified MusicHub as an active music-distribution route with register/login, Beatport distribution, Artist Bio Page, release-planning and promo-guide resources. No registration, login, release creation, DSP delivery, payment or protected workflow was accessed.'
  },
  {
    name: 'Beatport Hype Independent Electronic Label Promotion Route',
    websiteUrl: 'https://greenroom.beatport.com/labels',
    submissionUrl: 'https://greenroom.beatport.com/labels',
    sourceUrl: 'https://greenroom.beatport.com/labels',
    sourceType: 'automation_run_16_public_research',
    country: 'Global electronic/DJ market',
    language: 'en',
    genres: ['electronic', 'house', 'techno', 'drum and bass', 'dubstep', 'label-promotion', 'dj-store'],
    submissionMethod: 'beatport-hype-label-promotion-and-curator-listening-route-needs-label-eligibility-review',
    feeRequired: true,
    loginRequired: true,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Beatport Hype is label-focused and promises curator listening/visibility for independent labels, but MarcsMusic label eligibility, Beatport catalogue status, release exclusivity, fees and promotional terms need manual review.',
    notes:
      'Research verified Beatport Hype through Beatport Greenroom as an independent-label growth accelerator with curator listening, homepage/genre placements, Hype Charts and other store promotion mechanics. No Hype application, label onboarding, payment, exclusive-release setup or protected workflow was accessed.'
  }
];
