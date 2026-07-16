import type { PlatformInput } from '../models/types.js';
import { run396SeedPlatforms } from './run396PlatformSeeds.js';

export const run395SeedPlatforms: PlatformInput[] = [
  {
    name: 'Radio K KUOM Official Digital Music Submission Route',
    websiteUrl: 'https://radiok.org/',
    submissionUrl: 'https://radiok.org/submitting-music',
    sourceUrl: 'https://radiok.org/submitting-music',
    sourceType: 'automation_run_395_public_research',
    country: 'United States / Minneapolis, Minnesota student-run college radio',
    language: 'en',
    genres: [
      'college-radio',
      'independent-music',
      'alternative',
      'electronic',
      'hip-hop',
      'world-music',
      'reggae-adjacent',
      'digital-download-link',
      'protected-business-email',
      'physical-media-alternative',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-protected-music-department-email-with-download-link',
    feeRequired: false,
    feeAmount:
      'Radio K states no submission fee, login or mandatory platform payment for its digital Music Department route. The separately authorized physical-CD route can incur ordinary artist-controlled postage and is not the queued free-first route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Radio K explicitly authorizes independent artists to submit a digital release to its Music Department by email, using a downloadable .zip link hosted on Google Drive, Dropbox or a similar service. It prefers high-quality lossless WAV or FLAC files and also accepts a Bandcamp download code or a free-download release link. The Music Department destination is presented through a first-party Cloudflare-protected email link and was not decoded, guessed or stored. A human must open the official submission page in a normal browser, use the designated Music Department contact, select a genuinely suitable MarcsMusic release, confirm link permissions and include the published short metadata sheet. Do not request tracking, send Spotify-only or non-downloadable links, contact adjacent staff, decode the protected address, or automate the email. Confirm international eligibility, explicit-content handling and AI-origin policy before sending.',
    notes:
      'Verified on 2026-07-16 from Radio K KUOM official Submitting Music, Contact, About, homepage, playlist and schedule surfaces. The official guidance authorizes both digital and physical release delivery. The queued free-first route is digital: email the Music Department with a downloadable .zip link on Google Drive, Dropbox or similar, preferably containing lossless WAV or FLAC files; Bandcamp download codes or free-download release links are also accepted. Radio K asks for a concise information sheet containing a short bio, contact details, genuinely similar artists, non-FCC-friendly tracks and two or three recommended radio tracks. The station says it generally does not play classical or Top 40, receives a very high volume of music and does not accept tracking requests. Current operation was confirmed through the official live site, current July 2026 event and editorial content, current rotation additions, playlist access and four terrestrial/online signals. The protected Music Department email address was not decoded and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, form field, audio file, download link, package, login, CAPTCHA or payment was submitted.'
  },
  ...run396SeedPlatforms
];
