import type { PlatformInput } from '../models/types.js';

export const run26SeedPlatforms: PlatformInput[] = [
  {
    name: 'FBi Radio Music Submission Route',
    websiteUrl: 'https://fbiradio.com/',
    submissionUrl: 'https://fbiradio.com/music-submissions/',
    sourceUrl: 'https://fbiradio.com/music-submissions/',
    sourceType: 'automation_run_26_public_research',
    country: 'Australia / Sydney / global independent radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'hip-hop', 'rnb', 'indie', 'pop', 'rock', 'world', 'reggae', 'experimental', 'radio-airplay'],
    submissionMethod: 'public-music-submission-email-route-with-stream-and-download-link-requirements',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official FBi submission route uses music@fbiradio.com and requires a complete pitch package with clear subject, artist bio, press image, streaming link and high-quality download link. Manual review is required before sending a tailored email package; paid promotional campaign options are explicitly blocked.',
    notes:
      'FBi Radio is active with recent 2026 content and publishes a public music submission route. The site also lists paid promotional campaign possibilities separately; do not start or discuss paid promotion without owner approval. No email was sent.'
  },
  {
    name: 'PBS 106.7FM Melbourne Digital Music Submission Form',
    websiteUrl: 'https://www.pbsfm.org.au/',
    submissionUrl: 'https://www.pbsfm.org.au/submit-music',
    sourceUrl: 'https://www.pbsfm.org.au/submit-music',
    sourceType: 'automation_run_26_public_research',
    country: 'Australia / Melbourne / global independent radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'soul', 'funk', 'jazz', 'blues', 'world', 'reggae', 'indie', 'hip-hop', 'radio-airplay'],
    submissionMethod: 'public-digital-music-submission-form-with-captcha-and-download-link-requirements',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official PBS form is public and accepts local and international music, but the form includes anti-spam/CAPTCHA controls and requires human-provided release, bio, stream and high-quality download details. Do not bypass CAPTCHA or auto-submit.',
    notes:
      'PBS shows active 2026 station/editorial activity and prefers digital submissions. Queue for manual form completion only after MarcsMusic release assets are reviewed.'
  },
  {
    name: '2SER 107.3FM Music Airplay Consideration Form',
    websiteUrl: 'https://2ser.com/',
    submissionUrl: 'https://2ser.com/submit-music/',
    sourceUrl: 'https://2ser.com/submit-music/',
    sourceType: 'automation_run_26_public_research',
    country: 'Australia / Sydney / independent community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'hip-hop', 'rnb', 'world', 'reggae', 'experimental', 'radio-airplay'],
    submissionMethod: 'public-airplay-consideration-form-with-dynamic-loading-needs-human-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The public 2SER page exposes an airplay consideration form and required release fields, but the form is dynamically loaded. Manual review is required to avoid automated form interaction and to ensure release suitability.',
    notes:
      '2SER is active and publishes current music/editorial content. No dynamic form submission, upload or anti-bot bypass was attempted.'
  },
  {
    name: 'RTRFM 92.1 Perth Music Submission Form and Presenter Servicing Route',
    websiteUrl: 'https://rtrfm.com.au/',
    submissionUrl: 'https://rtrfm.com.au/about/submit-your-music/',
    sourceUrl: 'https://rtrfm.com.au/about/submit-your-music/',
    sourceType: 'automation_run_26_public_research',
    country: 'Australia / Perth / independent radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'beats', 'dub', 'reggae', 'world', 'hip-hop', 'indie', 'alternative', 'experimental', 'radio-airplay'],
    submissionMethod: 'public-submit-your-music-form-with-protected-email-and-file-upload-fields',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'RTRFM provides a public form and protected presenter/music emails, but the form includes validation/honeypot-style fields, optional bio upload and protected contact links. Do not decode protected emails or auto-submit; manual routing is required.',
    notes:
      'RTRFM is active with current 2026 shows, stories and events. The station is non-playlisted and presenter-driven, so genre targeting is required before any manual submission.'
  },
  {
    name: '4ZZZ Brisbane Music Submissions Route',
    websiteUrl: 'https://4zzz.org.au/',
    submissionUrl: 'https://www.4zzz.org.au/music-submissions',
    sourceUrl: 'https://4zzz.org.au/',
    sourceType: 'automation_run_26_public_research',
    country: 'Australia / Brisbane / community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'punk', 'indie', 'alternative', 'hip-hop', 'reggae', 'world', 'local-music', 'radio-airplay'],
    submissionMethod: 'official-site-music-submissions-link-found-route-details-require-human-validation',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official 4ZZZ navigation exposes a Music Submissions route and the station is active, but the submission page content could not be safely fetched in this run. Treat as manual validation only and do not infer missing form or email details.',
    notes:
      '4ZZZ homepage shows current 2026 programming and music department activity, including current Top 20/Album of the Week context and public reception contact. Submission details require human verification from the official page.'
  },
  {
    name: 'KBOO Community Radio Portland Physical Music Submission Route',
    websiteUrl: 'https://www.kboo.fm/',
    submissionUrl: 'https://www.kboo.fm/submit-your-music',
    sourceUrl: 'https://www.kboo.fm/submit-your-music',
    sourceType: 'automation_run_26_public_research',
    country: 'United States / Portland Oregon / community radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'hip-hop', 'folk', 'jazz', 'rock', 'punk', 'experimental', 'radio-airplay'],
    submissionMethod: 'public-physical-mail-submission-route-by-genre-attention-lines',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KBOO states it does not yet have a digital library and cannot download/burn CDs of digital submissions. Submissions are physical/mail-based and become property of KBOO, so owner approval is required before mailing physical media.',
    notes:
      'KBOO is active with recent 2026 audio/playlists and provides genre-specific attention names for electronic, rock/punk, jazz, hip-hop, world/reggae and other submissions. No mail, account or upload action was attempted.'
  },
  {
    name: 'KZSU Stanford Music Director and Send Music Route',
    websiteUrl: 'https://kzsu.stanford.edu/',
    submissionUrl: 'https://go.kzsu.fm/sendmusic',
    sourceUrl: 'https://kzsu.stanford.edu/contact/',
    sourceType: 'automation_run_26_public_research',
    country: 'United States / Stanford California / college radio audience',
    language: 'en',
    genres: ['electronic', 'dance', 'indie', 'alternative', 'hip-hop', 'jazz', 'experimental', 'college-radio', 'radio-airplay'],
    submissionMethod: 'public-contact-page-music-director-email-and-send-music-link-cookie-protected',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KZSU lists a public Music Directors contact and send-music link, but the music/guidelines route is protected by cookie/session checks and one shortlink fetch failed. Do not bypass cookie/session controls; resolve manually from the public page.',
    notes:
      'Official KZSU contact page lists music@kzsu.stanford.edu, postal music submission address and a send-music route. The music system requires cookies for secure session handling, so no automated form interaction was attempted.'
  }
];
