import type { PlatformInput } from '../models/types.js';
import { run400SeedPlatforms } from './run400PlatformSeeds.js';

export const run399SeedPlatforms: PlatformInput[] = [
  {
    name: 'WFMU Music Department Contact and Physical Review Route',
    websiteUrl: 'https://wfmu.org/',
    submissionUrl: 'https://wfmu.org/sendmusic.html',
    sourceUrl: 'https://wfmu.org/sendmusic.html',
    sourceType: 'automation_run_399_public_research',
    country: 'United States / Jersey City, New Jersey independent freeform radio',
    language: 'en',
    genres: [
      'independent-radio',
      'freeform-radio',
      'experimental',
      'electronic',
      'world-fusion',
      'reggae-adjacent',
      'cross-genre',
      'javascript-dependent-contact-form',
      'protected-first-party-contact-route',
      'authorized-physical-review-material-route',
      'asset-free-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-department-contact-form-or-authorized-physical-review-material-route',
    feeRequired: false,
    feeAmount:
      'WFMU states no submission fee, account, login or mandatory payment requirement. The Music Department contact form is free-first. Optional physical-media production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WFMU’s official Send Music page explicitly accepts vinyl, CD, CD-R and cassette review materials addressed to current Music Director Jessica Romoff and links to a first-party Music Department contact form. The form requires JavaScript and exposes only name, email, subject and message fields; it does not publish a digital audio-delivery procedure, accepted links or files, metadata requirements, international digital eligibility, explicit-content rules or AI-origin policy. A human may use the official form only for a concise asset-free process inquiry, or may separately approve the published physical route. Do not attach or link audio through the inquiry, guess a hidden email address, automate JavaScript or anti-spam controls, or send both digitally and physically without instruction.',
    notes:
      'Verified on 2026-07-16 from WFMU’s official homepage, Send Music page, Contact page, Staff Directory, Music Department email form, Summer 2026 schedule and Heavily Played recordings page. The Send Music page explicitly welcomes vinyl, CD, CD-R and cassette materials for review and identifies Jessica Romoff as Music Director. The linked first-party form is addressed to Music Department, requires JavaScript and presents name, email, subject and message fields. No plaintext Music Department business email is published on the reviewed route; no address was decoded, inferred, guessed or copied from a third-party source. Current operation was confirmed through homepage archives dated July 15, 2026, playlists dated July 16, 2026, the Summer 2026 schedule and a 2026 Heavily Played section compiled by the Music Director. WFMU describes itself as independent freeform radio. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No form field, email, audio asset, attachment, link, physical package, login, CAPTCHA, consent or payment was submitted.'
  },
  ...run400SeedPlatforms
];
