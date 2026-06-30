import type { PlatformInput } from '../models/types.js';

export const run27SeedPlatforms: PlatformInput[] = [
  {
    name: 'WPRB 103.3 FM Princeton Music Submissions Route',
    websiteUrl: 'https://wprb.com/',
    submissionUrl: 'https://wprb.com/music-submissions/',
    sourceUrl: 'https://wprb.com/music-submissions/',
    sourceType: 'automation_run_27_public_research',
    country: 'United States / Princeton New Jersey / college and independent radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'experimental', 'jazz', 'world', 'reggae', 'ska', 'hip-hop', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-physical-and-email-music-submission-route-physical-prioritized',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official WPRB music submissions page accepts physical media and lists music@wprb.com, but physical submissions are prioritized. Manual review is required to choose physical vs email path, prepare radio-safe assets, and avoid sending untargeted automated email.',
    notes:
      'WPRB homepage shows active playlist/schedule data and the official Music Submissions route. No email was sent and no physical media was mailed.'
  },
  {
    name: 'KXLU 88.9 FM General and Demolisten Music Submissions',
    websiteUrl: 'https://kxlu.com/',
    submissionUrl: 'https://kxlu.com/contact/',
    sourceUrl: 'https://kxlu.com/contact/',
    sourceType: 'automation_run_27_public_research',
    country: 'United States / Los Angeles California / college and community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'punk', 'folk', 'latin', 'jazz', 'vinyl', 'experimental', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-staff-email-and-physical-submission-routes-with-fcc-clean-requirement',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KXLU lists public staff contacts and physical submission lanes for General Submissions, Demolisten, and A Fistful of Vinyl, with FCC-clean-only requirements. Manual review is required to choose the correct route and avoid sending non-clean or misrouted material.',
    notes:
      'KXLU homepage shows current playlist activity and 2026 blog activity. No email was sent and no physical package was prepared.'
  },
  {
    name: 'KSPC 88.7FM Claremont Music Submissions',
    websiteUrl: 'https://kspc.org/',
    submissionUrl: 'https://kspc.org/contact/music-submissions/',
    sourceUrl: 'https://kspc.org/contact/music-submissions/',
    sourceType: 'automation_run_27_public_research',
    country: 'United States / Claremont California / college and community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'underground', 'jazz', 'hip-hop', 'reggae', 'local-music', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-album-or-ep-submission-route-via-physical-mail-or-downloadable-digital-email',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KSPC accepts albums or EPs by mailed CD/record or digital email with downloadable files, rejects singles/demos/AI-generated work, and states review is required before airplay. Manual review is required for album eligibility, AI/originality policy, and downloadable asset preparation.',
    notes:
      'KSPC homepage shows 2026 activity and the official Music Submissions page. No email, upload or mail action was attempted.'
  },
  {
    name: 'KRCL 90.9FM Salt Lake City Music Submission Route',
    websiteUrl: 'https://krcl.org/',
    submissionUrl: 'https://krcl.org/about/how-to-submit-music/',
    sourceUrl: 'https://krcl.org/about/how-to-submit-music/',
    sourceType: 'automation_run_27_public_research',
    country: 'United States / Salt Lake City Utah / community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'folk', 'blues', 'world', 'singer-songwriter', 'local-music', 'community-radio', 'radio-airplay'],
    submissionMethod: 'public-physical-music-submission-route-with-local-digital-upload-form-for-utah-artists',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KRCL accepts physical CDs and has a separate Google form for Utah-based local music only. Manual review is required because submitted music becomes station property and the local digital route is region-restricted.',
    notes:
      'KRCL homepage shows active 2026 community/music programming. No Google form was opened for submission, no files were uploaded and no physical copy was mailed.'
  },
  {
    name: 'WCBN-FM Ann Arbor Music Director Physical Submission Route',
    websiteUrl: 'https://wcbn.org/',
    submissionUrl: 'https://wcbn.org/c/',
    sourceUrl: 'https://wcbn.org/c/',
    sourceType: 'automation_run_27_public_research',
    country: 'United States / Ann Arbor Michigan / student-run freeform radio audience',
    language: 'en',
    genres: ['electronic', 'dancehall-reggae', 'techno', 'hip-hop', 'jazz', 'world', 'experimental', 'indie', 'alternative', 'freeform', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-contact-page-music-director-email-and-hard-copy-album-submission-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WCBN lists public music director contact information and states it accepts hard-copy albums, preferably CD or vinyl, from any musicians. Manual review is required to prepare physical media, choose genre care-of targeting and avoid unsolicited automated email.',
    notes:
      'WCBN homepage shows 24/7 broadcast and active recent content. No email was sent and no physical copy was mailed.'
  },
  {
    name: 'WMBR 88.1 FM MIT How To Get Your Music Played Route',
    websiteUrl: 'https://wmbr.org/',
    submissionUrl: 'https://wmbr.org/www/md',
    sourceUrl: 'https://wmbr.org/www/md',
    sourceType: 'automation_run_27_public_research',
    country: 'United States / Cambridge Massachusetts / MIT freeform radio audience',
    language: 'en',
    genres: ['electronic', 'rpm-techno', 'experimental', 'garage', 'punk', 'hip-hop', 'jazz', 'world', 'folk', 'local-music', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-physical-music-submission-route-with-genre-specific-contact-targeting',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WMBR explicitly prefers tangible physical submissions, says it does not have time to evaluate MP3s, discourages unsolicited mailing-list behavior and recommends show/genre targeting. Manual review is required before any physical mailing or host-specific outreach.',
    notes:
      'WMBR homepage shows live/active station data and its Your Music page gives the authorized submission route. No email was sent and no physical media was mailed.'
  },
  {
    name: 'WZBC 90.3 FM Boston College Programming Contact Route',
    websiteUrl: 'https://www.wzbc.org/',
    submissionUrl: 'https://www.wzbc.org/',
    sourceUrl: 'https://www.wzbc.org/',
    sourceType: 'automation_run_27_public_research',
    country: 'United States / Newton Massachusetts / Boston college radio audience',
    language: 'en',
    genres: ['electronic', 'experimental', 'alternative', 'indie', 'middle-eastern', 'funk', 'lounge', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-station-contact-route-for-programming-promotions-and-concert-questions',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WZBC publishes public programming/promotions/concert contact emails but does not expose a dedicated safe auto-submit form in the fetched page. Queue as contact-route validation only; do not submit music automatically or infer missing submission instructions.',
    notes:
      'WZBC site shows current station activity, playlists, archive links and public contact emails. Treat as a lower-confidence manual opportunity pending human confirmation of the preferred music-submission process.'
  }
];
