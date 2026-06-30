import type { PlatformInput } from '../models/types.js';

export const run33SeedPlatforms: PlatformInput[] = [
  {
    name: 'CKUW 95.9 FM Winnipeg Music Director Submission Route',
    websiteUrl: 'https://ckuw.ca/',
    submissionUrl: 'https://ckuw.ca/contact',
    sourceUrl: 'https://ckuw.ca/contact',
    sourceType: 'automation_run_33_public_research',
    country: 'Canada / Winnipeg Manitoba / campus-community radio and global streaming audience',
    language: 'en',
    genres: [
      'reggae',
      'dub',
      'world',
      'electronic',
      'indie',
      'alternative',
      'hip-hop',
      'jazz',
      'local-music',
      'campus-radio',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-music-director-email-and-high-quality-download-link-or-physical-media-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official CKUW guidance says not to send unsolicited MP3 attachments and to contact the Music Director about digital submissions or send a high-quality download link; outreach copy, clean edits, rights, download permissions and any physical-media decision require owner review.',
    notes:
      'Official contact page exposes the Music Director route and confirms cassette, CD, vinyl and reel-to-reel acceptance. Activity was verified through 2026 station news, live programming and 2026 charts. No email was sent and no SMTP/MX probing was performed in this repo update.'
  },
  {
    name: 'CIUT 89.5 FM Toronto New Music Submission Route',
    websiteUrl: 'https://ciut.fm/',
    submissionUrl: 'https://ciut.fm/contact/',
    sourceUrl: 'https://ciut.fm/contact/',
    sourceType: 'automation_run_33_public_research',
    country: 'Canada / Toronto Ontario / University of Toronto campus-community radio and online audience',
    language: 'en',
    genres: [
      'electronic',
      'ragga-jungle',
      'world',
      'latin',
      'roots',
      'indie',
      'rock',
      'hip-hop',
      'experimental',
      'campus-radio',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-new-music-email-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CIUT publishes a direct new-music submission email, but sending assets still requires manual validation of fit, clean/radio-safe edits, rights, links, metadata, bio and outreach copy; no automated email should be sent without owner approval.',
    notes:
      'Official CIUT pages verified 2026 station activity, Listen Live, a direct newmusic@ciut.fm submission route and relevant electronic, ragga-jungle, world, Latin and genre-spanning programming. No email, upload, login or form submission was attempted.'
  },
  {
    name: 'WRAS Album 88 Atlanta Regular Rotation Submission Route',
    websiteUrl: 'https://www.wrasfm.org/',
    submissionUrl: 'https://www.wrasfm.org/contact',
    sourceUrl: 'https://www.wrasfm.org/contact',
    sourceType: 'automation_run_33_public_research',
    country: 'United States / Atlanta Georgia / Georgia State University college-radio and online audience',
    language: 'en',
    genres: [
      'electronic',
      'underground',
      'local-music',
      'indie',
      'alternative',
      'hip-hop',
      'urban',
      'rpm',
      'college-radio',
      'specialty-show',
      'radio-airplay'
    ],
    submissionMethod: 'public-music-department-regular-rotation-email-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WRAS publishes regular-rotation Music Department addresses and asks for local Atlanta or generally underground music released in the past four months; release-date fit, genre lane, clean assets, metadata, rights and outreach copy require manual review before any email.',
    notes:
      'Official WRAS site verified current schedule, rotation links, contact page and regular rotation contacts for Music Department/RPM/Urban review. No emails were sent and no protected contact handling, form submission or SMTP/MX probing was attempted.'
  },
  {
    name: 'KVMR Music Department and Broadcaster Contact Review Route',
    websiteUrl: 'https://www.kvmr.org/',
    submissionUrl: 'https://www.kvmr.org/music-department/',
    sourceUrl: 'https://www.kvmr.org/music-department/',
    sourceType: 'automation_run_33_public_research',
    country: 'United States / Nevada City California / community radio, translators and online audience',
    language: 'en',
    genres: [
      'reggae',
      'dub',
      'world',
      'electronic',
      'roots',
      'folk',
      'americana',
      'rock',
      'community-radio',
      'broadcaster-targeting',
      'radio-airplay'
    ],
    submissionMethod: 'public-music-department-page-and-broadcaster-targeting-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KVMR exposes a Music Department page and broadcaster/contact forms, but the general and broadcaster contact forms include reCAPTCHA and individual broadcaster targeting; no CAPTCHA, dropdown, form, login or contact-routing control may be automated.',
    notes:
      'Official KVMR pages verified active programming, current shows, Music Department navigation, 2025 year-in-review music activity and public contact/broadcaster forms. No form was submitted and no anti-bot controls were bypassed.'
  },
  {
    name: 'Thomann Beatmaking Contest 2026 Public Hashtag Submission Route',
    websiteUrl: 'https://www.thomann.de/',
    submissionUrl: 'https://www.thomann.de/',
    sourceUrl:
      'https://www.musicradar.com/music-industry/events/whether-you-make-boom-bap-trap-house-lo-fi-drill-or-experimental-music-we-want-to-hear-your-unique-style-and-vision-thomann-launches-its-beat-making-competition-for-2026',
    sourceType: 'automation_run_33_public_research',
    country: 'Germany / global online producer-contest audience',
    language: 'en',
    genres: [
      'boom-bap',
      'trap',
      'house',
      'lo-fi',
      'drill',
      'experimental',
      'electronic',
      'beatmaking',
      'producer-contest',
      'global-submission'
    ],
    submissionMethod: 'public-contest-social-post-hashtag-submission-route',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Contest entry requires rules review, use of at least three official samples, a 30-60 second original beat, public social-platform posting and hashtag compliance; social login/public upload/hashtag posting must remain manual.',
    notes:
      'Fresh public research found the 2026 Thomann beatmaking contest open with a July 12, 2026 entry deadline and accepted social platforms/hashtag route. No account login, upload, hashtag post, sample-pack download or payment action was attempted.'
  }
];
