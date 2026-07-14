import type { PlatformInput } from '../models/types.js';

export const run366SeedPlatforms: PlatformInput[] = [
  {
    name: 'CFUV 101.9 FM Digital Music Director Submission Route',
    websiteUrl: 'https://cfuv.uvic.ca/',
    submissionUrl: 'https://cfuv.uvic.ca/music-submissions/',
    sourceUrl: 'https://cfuv.uvic.ca/music-submissions/',
    sourceType: 'automation_run_366_public_research',
    country: 'Canada / Victoria, British Columbia / non-profit campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'electronic',
      'electronica',
      'ambient',
      'experimental',
      'avant-garde',
      'noise',
      'breakbeat',
      'dub',
      'reggae',
      'world-music',
      'global',
      'hip-hop',
      'amapiano',
      'gqom',
      'house',
      'synthwave',
      'campus-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-cfuv-music-director-email-with-download-link',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated on the official submission guidelines.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CFUV accepts digital submissions at music@cfuv.ca. A submission must contain at least three unique tracks, use MP3 files at a minimum of 320 kbps and be delivered through a downloadable link such as !earshot Distro, Dropbox, Google Drive, WeTransfer, Box or DISCO. A proper track listing is mandatory; a one-page biography is helpful. CFUV no longer accepts physical music from non-local artists. A human must confirm that the selected MarcsMusic release has at least three unique tracks, prepare the 320-kbps MP3 download package and metadata, verify international eligibility because it is not explicitly stated, and send manually. Stop if any CAPTCHA, login, payment or new restriction appears.',
    notes:
      'Verified on 2026-07-15 from CFUV official Music Submissions, Contact, Shows and homepage pages. The role mailbox music@cfuv.ca is published on both the submission and staff-contact pages and was verified by repeated first-party publication, valid syntax, official-domain alignment and explicit Music Director purpose. No SMTP, MX, catch-all or mailbox-level probe was performed. Current operation was confirmed through the live stream, active weekly schedule and current show descriptions spanning electronica, hip-hop, reggae, dub, breakbeat, ambient, experimental, world music, amapiano, gqom, house and synthwave. No email, download link, file, metadata, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'CHSR-FM 97.9 Digital and Physical Music Submission Route',
    websiteUrl: 'https://chsrfm.ca/',
    submissionUrl: 'https://chsrfm.ca/blog/about/get-your-music-on-chsr',
    sourceUrl: 'https://chsrfm.ca/blog/about/get-your-music-on-chsr',
    sourceType: 'automation_run_366_public_research',
    country: 'Canada / Fredericton, New Brunswick / campus and community radio',
    language: 'en',
    genres: [
      'all-genres',
      'independent',
      'electronic',
      'electronica',
      'dance',
      'remix',
      'chiptune',
      'experimental',
      'ambient',
      'global',
      'world-music',
      'reggae',
      'hip-hop',
      'campus-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'international-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-chsr-obfuscated-music-director-email-or-authorized-physical-media',
    feeRequired: false,
    feeAmount:
      'No editorial submission fee or mandatory payment is stated. Optional physical-copy production, postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CHSR states that it accepts new music of all genres at any time. Digital submissions must be MP3 at a minimum of 320 kbps and may be supplied through a downloadable link such as WeTransfer, Dropbox or Google Drive, or as email attachments. The official page and contact page publish the Music Director route in human-readable obfuscated form rather than plaintext; it was not machine-decoded or stored as a plaintext address. Physical CDs, LPs and cassettes are also authorized, and the page discusses longer delivery times for packages from outside Canada, confirming international physical eligibility. A human must open the first-party page, manually use the displayed Music Director route, select the delivery method, include a clear track list plus artist, genre, location and contact information, and send manually. Do not use the adjacent sessions, PSA or general-contact routes as substitutes.',
    notes:
      'Verified on 2026-07-15 from CHSR official Music Submissions, Contact and homepage pages. The submission instructions were last marked updated in March 2023 but remain linked in the current site navigation; current operation was independently confirmed through July 2026 shows, playlists, archives and station posts. The same first-party role address appears in obfuscated form on both the submission and contact pages, aligned to the official chsrfm.ca domain and explicit Music Director purpose. It was left in its published obfuscated form; no decoding, SMTP, MX, catch-all or mailbox-level probing was performed. The page also contains an adjacent contact form for sessions and interviews, which was not treated as the canonical music-submission route. No email, form, file, link, physical package, login, CAPTCHA or payment was submitted.'
  }
];
