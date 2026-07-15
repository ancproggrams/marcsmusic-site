import type { PlatformInput } from '../models/types.js';

export const run368SeedPlatforms: PlatformInput[] = [
  {
    name: 'CKUW 95.9 FM Digital Download-Link and Physical Media Submission Route',
    websiteUrl: 'https://ckuw.ca/',
    submissionUrl: 'https://ckuw.ca/contact',
    sourceUrl: 'https://ckuw.ca/contact',
    sourceType: 'automation_run_368_public_research',
    country: 'Canada / Winnipeg, Manitoba / non-profit campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'electronic-exploratory',
      'ambient',
      'downtempo',
      'experimental',
      'hip-hop',
      'world-music',
      'dancehall',
      'reggae',
      'dub',
      'dance',
      'campus-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-ckuw-music-director-download-link-or-physical-media',
    feeRequired: false,
    feeAmount:
      'No editorial submission fee or mandatory payment is stated. Physical-copy production, postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CKUW instructs artists not to email unsolicited MP3 attachments. Digital submissions must use the official Music Director route and provide a high-quality downloadable link suitable for broadcast, or first ask the Music Director about the current digital process. CKUW also accepts cassette, CD, vinyl and reel-to-reel submissions at its published station address. A human must choose an appropriate MarcsMusic release, prepare a stable broadcast-quality download, confirm current metadata and international-eligibility requirements, use the official contact manually and handle any physical package. Stop if a CAPTCHA, login, payment or new restriction appears.',
    notes:
      'Verified on 2026-07-15 from CKUW official Contact, Staff, Programs, Schedule, Charts and homepage pages. The official Staff page identifies David Tymoshchuk as Music Director and displays music@ckuw.ca; the Contact page provides the same purpose-bound Email the Music Director route for high-quality download links. Verification covered first-party publication, valid syntax, official-domain alignment and explicit Music Director purpose. Current operation was confirmed through live schedule data, official posts through June 9, 2026 and active electronic/exploratory, ambient/down-tempo, electronica, hip-hop, world and dancehall/reggae programming. No SMTP, MX, catch-all or mailbox-level probe was performed. No email, file, link, physical package, login, CAPTCHA or payment was submitted.'
  },
  {
    name: '101.5 UMFM / CJUM Digital Download-Link and CD Submission Route',
    websiteUrl: 'https://umfm.com/',
    submissionUrl: 'https://umfm.com/about/music-faq',
    sourceUrl: 'https://umfm.com/about/music-faq',
    sourceType: 'automation_run_368_public_research',
    country: 'Canada / Winnipeg, Manitoba / volunteer-driven campus radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'breakbeat',
      'uk-garage',
      'house',
      'bass-music',
      'hip-hop',
      'world-music',
      'indie-rock',
      'funk',
      'soul',
      'campus-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-umfm-program-director-secure-download-link-or-cd',
    feeRequired: false,
    feeAmount:
      'No editorial submission fee or mandatory payment is stated. Physical-CD production, postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'UMFM authorizes digital submissions only through a secure downloadable link sent by its official Program Director email action. Accepted delivery examples include WeTransfer, Dropbox, Google Drive, Bandcamp, DISCO and embedded links; individual MP3 or other audio attachments are rejected. Physical CDs may be mailed or dropped off to the Music Director. Physical singles are rejected and EPs must contain at least four songs, while digital-single eligibility and international eligibility are not explicit. A human must select an eligible release, use the first-party protected email action without decoding or guessing the address, prepare a secure downloadable link and send manually. Stop if a CAPTCHA, login, mandatory payment or new restriction appears.',
    notes:
      'Verified on 2026-07-15 from UMFM official Music Department FAQ, Contact, homepage, Charts and Program Directory pages. The FAQ identifies Program Director Michael Elves and provides a purpose-bound email action for downloadable-link submissions, but the destination is Cloudflare-protected in passive rendering and was not decoded, inferred or stored. Current activity was confirmed through official news dated July 6, 2026, charts through June 29, 2026, live schedule data and active electronic, breakbeat, UK garage, bass-house, hip-hop and world programming. No SMTP, MX, catch-all or mailbox-level probe was performed. No email, attachment, download link, CD, login, CAPTCHA or payment was submitted.'
  }
];
