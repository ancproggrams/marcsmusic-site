import type { PlatformInput } from '../models/types.js';
import { run391SeedPlatforms } from './run391PlatformSeeds.js';

export const run390SeedPlatforms: PlatformInput[] = [
  {
    name: 'KLSU 91.1 FM Music Director Pre-Submission Inquiry Route',
    websiteUrl: 'https://lsureveille.com/klsu/',
    submissionUrl: 'https://lsureveille.com/staff_name/anh-tu-nguyen/',
    sourceUrl: 'https://lsureveille.com/staff_name/anh-tu-nguyen/',
    sourceType: 'automation_run_390_public_research',
    country: 'United States / Baton Rouge, Louisiana college radio',
    language: 'en',
    genres: [
      'college-radio',
      'alternative',
      'freeform-radio',
      'independent-music',
      'underground-hip-hop',
      'funk',
      'new-music',
      'music-director',
      'protected-email',
      'pre-submission-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-current-music-director-protected-email-asset-free-process-inquiry-route',
    feeRequired: false,
    feeAmount: 'No inquiry fee, login or mandatory payment is stated on KLSU’s official Music Director or station pages.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KLSU’s current official staff directory identifies Anh-Tu Nguyen as Music Director and the first-party profile provides a protected Send an email action. KLSU does not publish an unsolicited-audio delivery policy, accepted formats, attachment or download-link rules, metadata requirements, international eligibility, release-window rules, explicit-content handling or AI-origin policy. The authorized queued action is therefore limited to a concise asset-free inquiry asking for the current airplay-submission procedure. A human must reopen the current profile, use only the displayed Music Director route, confirm the role remains current and send no audio, attachment or private link unless KLSU replies with explicit delivery instructions. The Station Manager route, general Student Media contacts, social accounts and postal address must not be used as substitutes.',
    notes:
      'Verified on 2026-07-16 from KLSU’s official station, About, Listen, Staff and current Music Director profile pages hosted by LSU Student Media. KLSU states that it broadcasts 24/7, streams worldwide, charts new college music and provides freeform specialty programming. Current operation was confirmed through playlists dated July 11, July 10, July 5 and July 4, 2026, plus the current staff directory. The Music Director email action is first-party and purpose-aligned but its destination is not shown in plaintext in passive rendering; it was not decoded, guessed, stored or probed. No email, form field, audio, attachment, link, metadata, physical package, login, CAPTCHA, consent or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  },
  ...run391SeedPlatforms
];