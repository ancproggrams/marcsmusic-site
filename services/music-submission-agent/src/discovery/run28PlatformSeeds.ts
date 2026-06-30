import type { PlatformInput } from '../models/types.js';

export const run28SeedPlatforms: PlatformInput[] = [
  {
    name: 'WMSE 91.7FM Milwaukee Music Department Submission Route',
    websiteUrl: 'https://wmse.org/',
    submissionUrl: 'https://wmse.org/about-wmse-radio/music-department/',
    sourceUrl: 'https://wmse.org/about-wmse-radio/music-department/',
    sourceType: 'automation_run_28_public_research',
    country: 'United States / Milwaukee Wisconsin / non-commercial radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'dub', 'reggae', 'indie', 'alternative', 'hip-hop', 'jazz', 'world', 'experimental', 'radio-airplay', 'community-radio'],
    submissionMethod: 'public-music-director-email-we-transfer-and-physical-media-submission-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WMSE accepts public music submissions through physical media and a Music Director email/WeTransfer path, but review by the Music Department, FCC-clean checks, file preparation and non-automated outreach are required.',
    notes:
      'Official WMSE Music Department page encourages submissions, lists accepted formats and public Music Director contact, and includes 2026 station footer data. No email, file transfer or physical mailing was attempted.'
  },
  {
    name: 'KCSB 91.9 FM Artist Inquiry and Music Library Submission Form',
    websiteUrl: 'https://www.kcsb.org/',
    submissionUrl: 'https://www.kcsb.org/contact/artist-inquiry/',
    sourceUrl: 'https://www.kcsb.org/contact/artist-inquiry/',
    sourceType: 'automation_run_28_public_research',
    country: 'United States / Santa Barbara California / college and community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'experimental', 'hip-hop', 'reggae', 'world', 'college-radio', 'radio-airplay', 'live-session'],
    submissionMethod: 'public-artist-inquiry-page-with-external-google-form-for-library-and-live-air-opportunities',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KCSB exposes an official Artist Inquiry route and links to an external Google Form for live on-air, event, music library and premiere consideration. Manual review is required because the form is external and may contain validation, eligibility or anti-spam controls.',
    notes:
      'KCSB homepage showed current 2026 posts and station activity. No Google Form was submitted and no files were uploaded.'
  },
  {
    name: 'CJSR 88.5 FM Edmonton Music Submission Route',
    websiteUrl: 'https://www.cjsr.com/',
    submissionUrl: 'https://www.cjsr.com/submit-music/',
    sourceUrl: 'https://www.cjsr.com/submit-music/',
    sourceType: 'automation_run_28_public_research',
    country: 'Canada / Edmonton Alberta / independent campus and community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'dub', 'reggae', 'hip-hop', 'indie', 'alternative', 'experimental', 'punk', 'world', 'radio-airplay', 'campus-radio'],
    submissionMethod: 'public-digital-album-ep-email-route-with-physical-mail-drop-off-option',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CJSR accepts digital albums/EPs by public music email and physical media by mail/drop-off, but rejects paid streaming-only links and singles, requires downloadable files and content metadata, and includes a separate paid advertising upsell that must remain blocked.',
    notes:
      'Official CJSR Submit Music page gives the route and the homepage footer lists Submit Music with 2026 site activity. No email, download link, upload or paid advertising action was attempted.'
  },
  {
    name: 'CFUV 101.9 FM Victoria Music Submissions',
    websiteUrl: 'https://cfuv.uvic.ca/',
    submissionUrl: 'https://cfuv.uvic.ca/music-submissions/',
    sourceUrl: 'https://cfuv.uvic.ca/music-submissions/',
    sourceType: 'automation_run_28_public_research',
    country: 'Canada / Victoria British Columbia / campus and community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'folk-roots', 'blues', 'hip-hop', 'jazz', 'world', 'metal', 'classical', 'independent', 'underappreciated', 'radio-airplay'],
    submissionMethod: 'public-music-director-email-route-with-digital-download-link-requirements',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CFUV requires at least three unique tracks, 320kbps MP3 digital download links and complete biography/tracklisting metadata; physical submissions are restricted mostly to local artists or special cases. Manual review is required for eligibility and asset preparation.',
    notes:
      'Official CFUV music-submissions page lists the Music Director, music@cfuv.ca and detailed guidelines. No email, download link or physical media was sent.'
  },
  {
    name: 'Radio Western 94.9FM Music Submission Email Route',
    websiteUrl: 'https://radiowestern.ca/',
    submissionUrl: 'https://radiowestern.ca/',
    sourceUrl: 'https://radiowestern.ca/',
    sourceType: 'automation_run_28_public_research',
    country: 'Canada / London Ontario / campus and community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'hip-hop', 'reggae', 'world', 'experimental', 'college-radio', 'community-radio', 'radio-airplay'],
    submissionMethod: 'public-temporary-station-page-music-submission-email-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Radio Western official temporary page states the main web server is damaged but explicitly routes new music submissions and promotion to music@radiowestern.ca. Manual review is required because the site is degraded and no detailed asset policy is visible.',
    notes:
      'The official Radio Western page says the stream continues and gives a public music-submission email while warning not to use the general address. No email was sent.'
  }
];
