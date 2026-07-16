import type { PlatformInput } from '../models/types.js';
import { run403SeedPlatforms } from './run403PlatformSeeds.js';

export const run402SeedPlatforms: PlatformInput[] = [
  {
    name: 'KVRX 91.7 FM Music Department Submission Route',
    websiteUrl: 'https://kvrx.org/app/',
    submissionUrl: 'mailto:music@kvrx.org',
    sourceUrl: 'https://kvrx.org/app/contact/',
    sourceType: 'automation_run_402_public_research',
    country: 'United States / Austin, Texas college radio with worldwide online listening',
    language: 'en',
    genres: [
      'college-radio',
      'freeform-radio',
      'independent-music',
      'electronic',
      'experimental',
      'hip-hop',
      'world',
      'reggae',
      'cross-genre',
      'public-business-email',
      'authorized-email-submission-route',
      'authorized-physical-submission-alternative',
      'ai-provenance-restricted',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-department-email-or-physical-delivery-route',
    feeRequired: false,
    feeAmount:
      'KVRX states no submission fee, account, login or mandatory payment requirement. Digital email is the free-first route. Optional physical-media production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KVRX explicitly directs all music submissions for airplay consideration to music@kvrx.org and states that it currently accepts both physical and digital submissions. The same official page states that AI-assisted/generated music will not be considered. It does not publish current digital attachment-versus-link instructions, accepted formats, file-size limits, required metadata, international eligibility, release-window rules or explicit-content requirements. A human must verify that the selected MarcsMusic track was not AI-assisted or AI-generated, obtain or confirm current digital delivery specifications, and submit only once through the Music Department route. Do not use operations, programming, booking, social, newsletter or login routes as substitutes, and do not send any track whose provenance conflicts with the published AI restriction.',
    notes:
      'Verified on 2026-07-16 from KVRX’s official Contact, homepage, schedule and blog pages. The Contact page publishes music@kvrx.org in plaintext, explicitly instructs artists to send all music submissions there for airplay consideration, repeats the Music Department role, and states that both physical and digital submissions are currently accepted. It separately publishes operations@kvrx.org for questions, which is not counted as a second delivery route. The mailbox has valid syntax and exact kvrx.org domain alignment. Current operation was supported by the live now-playing interface, a Spring 2026 schedule with freeform and specialty programming, and official blog posts dated through June 2, 2026. Genre fit is broad, with official album-review categories including hip-hop/rap and world/reggae, while KVRX’s freeform format supports electronic and cross-genre discovery. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, audio, attachment, link, physical package, form field, login, CAPTCHA, consent or payment was submitted.'
  },
  ...run403SeedPlatforms
];
