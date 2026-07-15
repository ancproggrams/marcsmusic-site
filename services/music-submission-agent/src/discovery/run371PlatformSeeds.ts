import type { PlatformInput } from '../models/types.js';

export const run371SeedPlatforms: PlatformInput[] = [
  {
    name: 'CFRU 93.3 FM Digital EP and Album Submission Route',
    websiteUrl: 'https://www.cfru.ca/',
    submissionUrl: 'https://www.cfru.ca/music/',
    sourceUrl: 'https://www.cfru.ca/music/',
    sourceType: 'automation_run_371_public_research',
    country: 'Canada / Guelph campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'drum-and-bass',
      'dub',
      'reggae',
      'hip-hop',
      'global-music',
      'campus-radio',
      'community-radio',
      'email-submission',
      'digital-download-link',
      'manual-review'
    ],
    submissionMethod: 'official-music-director-email-with-download-link-for-ep-or-album',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CFRU accepts digital EPs and albums containing at least three different songs through music@cfru.ca. The message must include artist and album information, a track listing, contact information and a download link; 320-kbps MP3 is preferred. CFRU states that it is accepting digital submissions except in rare circumstances. A separate upload form is reserved for musicians within 50 km of Guelph and is not an authorized route for MarcsMusic. A human must select an eligible multi-track release, verify the download remains accessible, confirm international eligibility and current metadata expectations, send manually to the stated Music Director mailbox, and stop if a login, CAPTCHA, payment, attachment request or updated restriction appears.',
    notes:
      'Verified on 2026-07-15 from CFRU’s official Music page and current station site. The official page names Music Director Alexandra Rimmington, repeatedly publishes music@cfru.ca for submissions and questions, requires at least three distinct tracks and states that high-quality 320-kbps MP3 download links are preferred. Current station activity is evidenced by July 7 charts and 2026 programming and live-event archives. Email verification covered first-party publication, valid syntax, official-domain alignment and explicit Music Department purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, download link, attachment, local-only form, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'CJAM 99.1 FM Digital Four-Track Release Submission Route',
    websiteUrl: 'https://www.cjam.ca/',
    submissionUrl: 'https://www.cjam.ca/submit/',
    sourceUrl: 'https://www.cjam.ca/submit/',
    sourceType: 'automation_run_371_public_research',
    country: 'Canada / Windsor and Detroit campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'dub',
      'reggae',
      'hip-hop',
      'global-music',
      'campus-radio',
      'community-radio',
      'email-submission',
      'digital-download-link',
      'manual-review'
    ],
    submissionMethod: 'public-purpose-bound-music-director-gmail-with-download-link-for-four-track-release',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CJAM is digital-only and publishes cjammd@gmail.com for Music Director submissions. Artists must provide a reliable download link rather than direct MP3 attachments or Spotify, include information about the artist and release, and submit at least four original tracks. Audio must be at least 192 kbps in MP3 or AAC, while FLAC is also accepted, and files must contain complete ID tags. A human must select a qualifying multi-track MarcsMusic release, prepare a persistent download link and properly tagged files, confirm international eligibility and any current link-expiry limits, send manually to the stated mailbox, and stop if a login, CAPTCHA, payment, consent or updated restriction appears.',
    notes:
      'Verified on 2026-07-15 from CJAM’s official Submit page and active station homepage. The first-party page repeatedly publishes cjammd@gmail.com, rejects Spotify-only routes and direct MP3 attachments, requires a download link and four or more original tracks, and specifies minimum audio quality and tagging. CJAM published July 2026 Singles Club material and charts through June 29–July 5, 2026, including a recent electronic specialty chart. Email verification covered first-party publication, valid syntax and explicit Music Director submission purpose. The mailbox uses Gmail, so official-domain alignment is absent. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, file, link, attachment, login, CAPTCHA or payment was submitted.'
  }
];
