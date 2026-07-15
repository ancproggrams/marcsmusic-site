import type { PlatformInput } from '../models/types.js';
import { run386SeedPlatforms } from './run386PlatformSeeds.js';

export const run385SeedPlatforms: PlatformInput[] = [
  {
    name: 'KSDT Radio Music Department Pre-Submission Inquiry Route',
    websiteUrl: 'https://www.ksdtradio.com/',
    submissionUrl: 'https://www.ksdtradio.com/about',
    sourceUrl: 'https://www.ksdtradio.com/about',
    sourceType: 'automation_run_385_public_research',
    country: 'United States / La Jolla, California student-run college radio',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-music',
      'new-music',
      'electronic',
      'experimental',
      'hip-hop',
      'pop',
      'music-department',
      'manual-review'
    ],
    submissionMethod: 'official-public-current-music-staff-pre-submission-inquiry-email',
    feeRequired: false,
    feeAmount: 'No inquiry or submission fee is stated on the official About page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KSDT’s official About page publishes Sabrina Arruda as the current Music contact and provides a public station-domain mailbox, but the page does not explicitly authorize unsolicited audio delivery or publish attachment-versus-link rules, accepted formats, file-size limits, metadata or EPK requirements, release windows, international eligibility, clean or explicit-content rules, AI-origin policy, response times or physical-delivery instructions. A human must recheck the current role holder, send only a concise asset-free process inquiry, wait for explicit delivery instructions, permission-check the selected release and avoid parallel outreach to general, programming, media, events or other staff contacts.',
    notes:
      'Verified on 2026-07-15 from KSDT Radio’s official homepage and About page. The About page identifies Sabrina Arruda under Music and publishes sabrina@ksdt.org in plaintext. The address has valid syntax, uses KSDT’s station-branded domain and is purpose-bound to the current Music role, but it is retained only for an asset-free process inquiry because no direct music-delivery policy is published. The homepage contains active music coverage dated through April 2026 and recurring 2026 new-release features. No email, form field, file, link, login, CAPTCHA, consent or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  },
  ...run386SeedPlatforms
];
