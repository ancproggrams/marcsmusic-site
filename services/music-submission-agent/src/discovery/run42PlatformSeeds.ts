import type { PlatformInput } from '../models/types.js';

export const run42SeedPlatforms: PlatformInput[] = [
  {
    name: 'FBi Radio Sydney Music Submissions',
    websiteUrl: 'https://www.fbi.radio/',
    submissionUrl: 'https://www.fbi.radio/contact',
    sourceUrl: 'https://www.fbi.radio/contact',
    sourceType: 'automation_run_42_public_research',
    country: 'Australia / Sydney independent community radio',
    language: 'en',
    genres: [
      'sydney-local',
      'australian-music',
      'electronic',
      'experimental',
      'dance',
      'hip-hop',
      'r-and-b',
      'indie',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-music-submissions-email-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'FBi publishes an official contact page with a public Music Submissions mailbox. Manual review is required for Sydney/Australian music fit, track/package selection, rights and clean-edit checks, and runtime Mailgun/SMTP validation before any outbound email is sent.',
    notes:
      'Official fbi.radio contact page lists Music Submissions - music@fbiradio.com and states the station champions emerging Sydney music and culture. Activity was verified through recent 2026 episodes/articles on the official site. No email or message was sent.'
  },
  {
    name: '2SER 107.3FM Sydney Submit Your Music',
    websiteUrl: 'https://www.2ser.com/',
    submissionUrl: 'https://www.2ser.com/how-to-submit-music',
    sourceUrl: 'https://www.2ser.com/how-to-submit-music',
    sourceType: 'automation_run_42_public_research',
    country: 'Australia / Sydney community radio',
    language: 'en',
    genres: [
      'sydney',
      'australian-music',
      'experimental',
      'electronic',
      'country',
      'metal',
      'pop',
      'spatial-audio',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-airplay-consideration-form-and-music-director-email-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      '2SER publishes a submit-music airplay-consideration form and a Music Director mailbox. Manual review is required for form/session behavior, release date, artist bio, social links, location eligibility/context, download-link prep and runtime Mailgun/SMTP validation before any outbound use.',
    notes:
      'Official 2SER Submit Your Music page exposes a public airplay-consideration form with contact, release, bio, location and track fields; the Contact page also lists submitmusic@2ser.com and says not to send physical copies unless requested. No form or email was submitted.'
  },
  {
    name: 'PBS 106.7FM Melbourne Submit Your Music',
    websiteUrl: 'https://www.pbsfm.org.au/',
    submissionUrl: 'https://www.pbsfm.org.au/submitmusic',
    sourceUrl: 'https://www.pbsfm.org.au/submitmusic',
    sourceType: 'automation_run_42_public_research',
    country: 'Australia / Melbourne specialist community radio',
    language: 'en',
    genres: [
      'melbourne',
      'australian-music',
      'international',
      'electronic',
      'dub',
      'reggae',
      'soul',
      'jazz',
      'world',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-digital-submission-form-captcha-and-physical-music-department-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'PBS publishes an official Submit Your Music route with a digital form, CAPTCHA and physical CD/vinyl routing. Manual review is required because CAPTCHA must not be bypassed, music-download requirements must be checked, and physical-routing/presenter targeting needs owner approval.',
    notes:
      'Official PBS page says it accepts new music from local and international acts, prefers the digital form, requires music stream and high-quality download links, and includes CAPTCHA. No CAPTCHA, form, upload, hand-delivery or physical mail action was attempted.'
  },
  {
    name: 'Triple R 102.7FM Melbourne Submit Music',
    websiteUrl: 'https://www.rrr.org.au/',
    submissionUrl: 'https://www.rrr.org.au/get-involved/submit-music',
    sourceUrl: 'https://www.rrr.org.au/get-involved/submit-music',
    sourceType: 'automation_run_42_public_research',
    country: 'Australia / Melbourne independent community radio',
    language: 'en',
    genres: [
      'melbourne',
      'independent',
      'electronic',
      'hip-hop',
      'metal',
      'first-nations',
      'world',
      'experimental',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-station-music-email-and-program-targeting-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Triple R is non-playlisted and asks either to service relevant programs directly or email station-level streaming/download links and bio. Manual review is required for program fit, subject-line copy, non-login streaming links, high-quality download links, PDF/attachment avoidance and runtime Mailgun/SMTP validation.',
    notes:
      'Official Triple R Submit Music page lists music@rrr.org.au for station service, gives stream/download/subject/bio/gig guidance, and also provides a physical Music Department address. No email or physical package was sent.'
  },
  {
    name: 'SYN Media Melbourne Music Submissions',
    websiteUrl: 'https://www.syn.org.au/',
    submissionUrl: 'https://www.syn.org.au/contact',
    sourceUrl: 'https://www.syn.org.au/contact',
    sourceType: 'automation_run_42_public_research',
    country: 'Australia / Melbourne youth community radio',
    language: 'en',
    genres: [
      'melbourne',
      'australian-music',
      'youth-radio',
      'electronic',
      'hip-hop',
      'punk',
      'metal',
      'indie',
      'new-music',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-music-submissions-email-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'SYN publishes an official Music Submissions section with a public music mailbox and required package elements. Manual review is required for 320kbps MP3/WAV download-link preparation, no-attachment compliance, release details, press bio, rights/clean edit review and runtime Mailgun/SMTP validation before outreach.',
    notes:
      'Official SYN contact page says to service music to music@syn.org.au and lists required download link, press release/bio, release details and relevant links. No email or contact action was made.'
  }
];
