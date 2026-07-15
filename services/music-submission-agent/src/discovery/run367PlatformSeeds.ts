import type { PlatformInput } from '../models/types.js';

export const run367SeedPlatforms: PlatformInput[] = [
  {
    name: 'CJSR FM 88.5 Digital and Physical Album/EP Submission Route',
    websiteUrl: 'https://www.cjsr.com/',
    submissionUrl: 'https://www.cjsr.com/submit-music/',
    sourceUrl: 'https://www.cjsr.com/submit-music/',
    sourceType: 'automation_run_367_public_research',
    country: 'Canada / Edmonton, Alberta / non-profit campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'hip-hop',
      'international',
      'world-music',
      'reggae',
      'dub',
      'dance',
      'campus-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'international-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-cjsr-music-email-or-authorized-physical-media',
    feeRequired: false,
    feeAmount:
      'No editorial submission fee or mandatory payment is stated. An optional CAD 200 local advertising package is separate from editorial submission and is excluded. Physical-copy production, postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CJSR accepts digital albums and EPs at music@cjsr.com and physical CDs, vinyl, cassettes and similar playable media at its published Music Department address. Singles are rejected. Digital delivery must provide downloadable files through a stable cloud link or Bandcamp download code; Spotify, Tidal and other paid-streaming-only links are rejected, and expiring WeTransfer links are discouraged. A human must select an eligible album or EP, confirm that it is not wholly AI-generated under CJSR’s January 2026 AI policy, prepare tagged MP3 files, track lengths, focus tracks, artist origin, a one-sheet and language warnings, and send manually. Do not confuse the optional local advertising package with editorial consideration.',
    notes:
      'Verified on 2026-07-15 from CJSR official Submit Music, AI Policy, Contact and current chart pages. The public role mailbox music@cjsr.com is published specifically for digital album and EP submissions and was verified through first-party publication, valid syntax, official-domain alignment and explicit Music Department purpose. Current operation was confirmed through a chart published July 8, 2026 for the week ending July 7, 2026, including electronic, hip-hop and international categories. No SMTP, MX, catch-all or mailbox-level probe was performed. No email, file, cloud link, physical package, customs declaration, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'Stereofox SubmitHub or Groover Music Submission Route',
    websiteUrl: 'https://www.stereofox.com/',
    submissionUrl: 'https://www.stereofox.com/contact/',
    sourceUrl: 'https://www.stereofox.com/contact/',
    sourceType: 'automation_run_367_public_research',
    country: 'Global / independent online music publication, playlist curator and record label',
    language: 'en',
    genres: [
      'electronic',
      'electronica',
      'chill-electronica',
      'progressive-house',
      'melodic-house',
      'house',
      'uk-garage',
      'alternative-dance',
      'instrumental-hip-hop',
      'hip-hop',
      'soul',
      'r-and-b',
      'neo-soul',
      'funk',
      'music-blog',
      'playlist-curator',
      'external-platform-submission',
      'manual-review'
    ],
    submissionMethod: 'official-stereofox-submithub-or-groover-account-route',
    feeRequired: false,
    feeAmount:
      'Stereofox does not state a direct editorial fee on its official page. The authorized SubmitHub or Groover route may expose free, credit-based or paid options; current pricing must be reviewed manually and no purchase is authorized.',
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Stereofox explicitly accepts music only through its linked SubmitHub page or Groover route and states that email and Discord submissions are not processed. The external account-based workflow requires a human to sign in, inspect current fields, targeting, consent, privacy, CAPTCHA and free-versus-paid credit options, choose a suitable MarcsMusic release and submit manually. Stop before any payment or protected control unless separately approved. The general contact form and Discord server must not be used as submission workarounds.',
    notes:
      'Verified on 2026-07-15 from Stereofox’s official homepage and Contact/Music Submissions page. The homepage showed current editorial activity, recent music articles, active playlists and a 2026 copyright notice. Its current playlist taxonomy includes electronic, electronica, progressive house, melodic house, UK garage, chill electronica, instrumental hip-hop, soul and R&B. The official page links SubmitHub and mentions Groover as the only music-submission routes and rejects email or Discord submissions. No account was created, no sign-in, CAPTCHA, form, pitch, track, link, credit or payment was entered, and the external platform controls were not bypassed.'
  }
];
