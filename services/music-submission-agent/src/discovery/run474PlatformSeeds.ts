import type { PlatformInput } from '../models/types.js';
import { run475SeedPlatforms } from './run475PlatformSeeds.js';

export const run474SeedPlatforms: PlatformInput[] = [
  {
    name: 'CJSW 90.9 FM Digital Album Submission',
    websiteUrl: 'https://cjsw.com/',
    submissionUrl: 'https://cjsw.com/music/submit/',
    sourceUrl: 'https://form.jotform.com/260625704327253',
    sourceType: 'automation_run_474_public_research',
    country:
      'Canada (Calgary, Alberta); the form asks for artist location but does not explicitly confirm or exclude international artists.',
    language: 'en',
    genres: [
      'electronic',
      'reggae',
      'world',
      'global-bass',
      'indie',
      'hip-hop',
      'experimental',
      'digital-album',
      'mp3-zip-upload',
      'external-jotform',
      'full-release-only',
      'manual-review'
    ],
    submissionMethod:
      'official first-party route to a public Jotform requiring a complete recent EP or album as an MP3 ZIP plus artwork and permission for CJSW airplay/library use',
    feeRequired: false,
    feeAmount: 'No submission fee, checkout or payment requirement is published on the official CJSW route or visible Jotform.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The external upload form accepts no singles, requires a recent three-plus-track release, direct ZIP and artwork uploads, and permission to share the release with programmers and permanently add it to the digital library. International and AI eligibility, upload limits, all music/artwork rights, consent scope, hidden controls and the final submission require human approval.',
    notes:
      'Passively verified on 2026-07-18 from CJSW\'s official submission, programming and contact pages plus the linked Jotform. The station accepts only digital EPs or albums released within the previous three months, requires at least three unique tracks, MP3 files in a ZIP, release metadata, location, bio, RIYL, artwork and broadcast/library permission. The current July 17–23, 2026 schedule includes electronic, reggae, world, global-bass and multicultural programming relevant to MarcsMusic. No form field was filled, no file was uploaded, no optional local-artist signature was provided, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  {
    name: 'KAOS 89.3 FM Olympia Digital Music Submission',
    websiteUrl: 'https://www.kaosradio.org/',
    submissionUrl: 'https://www.kaosradio.org/submitmusic',
    sourceUrl: 'https://www.kaosradio.org/submitmusic',
    sourceType: 'automation_run_474_public_research',
    country:
      'United States (Olympia, Washington); digital submissions are accepted, but international-artist eligibility is not explicitly published.',
    language: 'en',
    genres: [
      'independent',
      'freeform',
      'electronic',
      'reggae',
      'world',
      'alternative',
      'full-release-only',
      'streaming-link',
      'download-link',
      'clean-radio',
      'email-submission',
      'physical-media-alternative',
      'manual-review'
    ],
    submissionMethod:
      'official public music-department email route using streaming and download links, with CD, vinyl or cassette delivery as a preferred physical alternative',
    feeRequired: false,
    feeAmount: 'No submission fee, checkout or mandatory payment is published for the digital or physical route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KAOS rejects singles, prohibits profane or indecent material at all hours, requires a full release and one-sheet or press release, and asks digital submitters to use links rather than attachments. Release selection, clean-content review, link permissions, metadata, rights, international and AI eligibility, email content and final send require human approval.',
    notes:
      'Passively verified on 2026-07-18 from KAOS\'s official submission and contact pages and its current Spinitron activity page. Digital submissions must use the subject Music Submission, include streaming and download links, and must not contain attachments. KAOS prefers physical releases, rejects singles, requests a one-sheet with focus tracks and FCC/clean-edit information, and states that it has no safe harbor for profanity or indecency. Spinitron displayed current July 16, 2026 programming and recent music shows. No email was drafted or sent, no link or physical release was delivered, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  {
    name: 'Glacer FM Paid Global Music Broadcast',
    websiteUrl: 'https://www.glacerfm.com/',
    submissionUrl: 'https://www.glacerfm.com/services/submit-your-music/',
    sourceUrl: 'https://www.glacerfm.com/services/submit-your-music/',
    sourceType: 'automation_run_474_public_research',
    country:
      'United States / global internet radio; the official route explicitly offers global broadcast for original music from artists worldwide.',
    language: 'en',
    genres: [
      'electronic',
      'reggae',
      'world',
      'dance',
      'house',
      'hip-hop',
      'r-and-b',
      'all-genres',
      'paid-airplay',
      'guaranteed-rotation',
      'email-invoice',
      'payment-required',
      'manual-review'
    ],
    submissionMethod:
      'official paid promotional-airplay email route requiring selection of a broadcast package and receipt of a payment invoice',
    feeRequired: true,
    feeAmount:
      'Published options include USD 30 for at least 30 days or USD 50 for at least 90 days of regular rotation; genre-block packages are USD 40 or USD 60, and album-focus options are USD 30 or USD 45.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'This is paid guaranteed promotional rotation rather than free editorial consideration. A human must decide whether the package is commercially and legally appropriate, review the invoice and terms, confirm original-music and all rights eligibility, assess AI policy and ROI, and explicitly authorize any email, payment and content delivery.',
    notes:
      'Passively verified on 2026-07-18 from Glacer FM\'s official submission, about and current chart pages. The route excludes cover music, publishes global all-genre broadcast packages and directs inquiries to administration@glacerfm.com for invoicing. The site displays a current Top 50, active programming blocks and a 2026 copyright notice. No package was selected, no email was sent, no invoice was requested, no track was delivered, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  ...run475SeedPlatforms
];
