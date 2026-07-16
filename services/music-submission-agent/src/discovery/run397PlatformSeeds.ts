import type { PlatformInput } from '../models/types.js';
import { run398SeedPlatforms } from './run398PlatformSeeds.js';

export const run397SeedPlatforms: PlatformInput[] = [
  {
    name: 'KQAL 89.5 FM Music Director Process Inquiry Route',
    websiteUrl: 'https://www.kqal.org/',
    submissionUrl: 'https://www.kqal.org/contact/',
    sourceUrl: 'https://www.kqal.org/contact/kqal-staff-directory/',
    sourceType: 'automation_run_397_public_research',
    country: 'United States / Winona, Minnesota university-operated college radio',
    language: 'en',
    genres: [
      'college-radio',
      'community-radio',
      'independent-music',
      'eclectic',
      'alternative',
      'latin-alternative',
      'cross-genre',
      'public-business-email',
      'captcha-contact-form-adjacent',
      'asset-free-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-station-email-addressed-to-current-music-director-asset-free-process-inquiry',
    feeRequired: false,
    feeAmount:
      'KQAL publishes no submission fee, account, login or mandatory payment for contacting the station. The queued action is a free, asset-free process inquiry only; no music-delivery procedure is publicly specified.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KQAL’s official staff directory identifies Jayley Andersen as Music Director, while the official Contact page publishes kqalfm@winona.edu and a general contact form containing CAPTCHA. The reviewed first-party pages do not explicitly authorize unsolicited audio delivery or publish attachment, download-link, format, metadata, international-eligibility, content or AI-origin rules. A human may send one concise, asset-free email to the public station mailbox asking to be routed to the current Music Director and requesting KQAL’s authorized music-submission procedure. Do not attach audio, include private links, guess a personal address, automate the CAPTCHA form or treat the postal address as a music-submission route. Stop if the live process introduces login, payment, consent, authentication or another protected workflow.',
    notes:
      'Verified on 2026-07-16 from KQAL’s official homepage, Contact page, staff directory, programming schedule, events calendar and linked Spinitron station page. The Contact page publishes kqalfm@winona.edu in plaintext; the address has valid syntax and uses Winona State University’s official winona.edu domain. The same page exposes a general contact form with a visible CAPTCHA, which was not completed or automated. The staff directory currently lists Jayley Andersen as Music Director. Current operation was supported by the active live-player surface, a 2026 copyright notice, a populated weekly schedule, July through September 2026 calendar entries and a linked Spinitron station page showing June 26, 2026 programming and track history. KQAL’s schedule includes The Rock Pile, The Late Shift and The Latin Alternative, supporting broad college-radio and cross-genre fit for careful human selection of a MarcsMusic release. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, form field, CAPTCHA, audio file, attachment, link, login or payment was submitted.'
  },
  ...run398SeedPlatforms
];
