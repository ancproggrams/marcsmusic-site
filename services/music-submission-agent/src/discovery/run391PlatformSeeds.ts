import type { PlatformInput } from '../models/types.js';
import { run392SeedPlatforms } from './run392PlatformSeeds.js';

export const run391SeedPlatforms: PlatformInput[] = [
  {
    name: 'WXCU Radio Original Music Airplay Submission Route',
    websiteUrl: 'https://www.wxcuradio.com/',
    submissionUrl: 'https://www.wxcuradio.com/',
    sourceUrl: 'https://www.wxcuradio.com/',
    sourceType: 'automation_run_391_public_research',
    country: 'United States / Bexley, Ohio college radio',
    language: 'en',
    genres: [
      'college-radio',
      'independent-music',
      'original-music',
      'alternative',
      'electronic',
      'hip-hop',
      'rock',
      'music-director',
      'public-form',
      'public-business-email',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-airplay-form-or-station-email-route',
    feeRequired: false,
    feeAmount: 'No submission fee, login or mandatory payment is stated on WXCU Radio’s official submission or contact surfaces.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WXCU expressly invites artists with original music to use the form on its official homepage or contact wxcuradio@capital.edu to seek airplay. The passive first-party representation confirms the form and mailbox but does not expose the form fields, upload or link method, live validation, consent controls, anti-spam controls, international eligibility, accepted audio formats, file-size limits, metadata requirements, release-window rules, explicit-content handling or AI-origin policy. A human must reopen the live homepage, inspect the form without bypassing any controls, choose either the form or email route once, confirm the current requirements and provide music only through the method WXCU currently requests. Do not submit through both routes or use individual DJ, management, social-media or postal contacts as substitutes.',
    notes:
      'Verified on 2026-07-16 from WXCU Radio’s official homepage, Contact, Management Team and Blog pages. The homepage states “Get YOUR Music On Air!”, asks whether the visitor has original music and wants it played over WXCU’s airwaves, and directs artists to fill out the form below or contact wxcuradio@capital.edu. The Contact page republishes the same address in plaintext. The mailbox has valid syntax and uses Capital University’s institutional capital.edu domain. Current operation was supported by the live stream, an active 2026 management roster, a named Music Director and Studio Manager who joined management in spring 2026, and current-semester station language. The latest visible blog posts are dated November 9, 2025. No form field, email, audio file, attachment, link, personal information, login, CAPTCHA, consent or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  },
  ...run392SeedPlatforms
];
