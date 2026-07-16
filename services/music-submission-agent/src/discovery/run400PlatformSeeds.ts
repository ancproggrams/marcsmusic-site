import type { PlatformInput } from '../models/types.js';

export const run400SeedPlatforms: PlatformInput[] = [
  {
    name: 'WREK 91.1 FM Music Director Submission Route',
    websiteUrl: 'https://www.wrek.org/',
    submissionUrl: 'https://old.wrek.org/submissions/',
    sourceUrl: 'https://old.wrek.org/submissions/',
    sourceType: 'automation_run_400_public_research',
    country: 'United States / Atlanta, Georgia college radio',
    language: 'en',
    genres: [
      'college-radio',
      'independent-radio',
      'electronic',
      'ambient',
      'experimental',
      'reggae',
      'dub',
      'hip-hop',
      'world',
      'international',
      'cross-genre',
      'public-business-email',
      'authorized-email-submission-route',
      'authorized-physical-submission-alternative',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-director-email-or-physical-mail-route',
    feeRequired: false,
    feeAmount:
      'WREK states no submission fee, account, login or mandatory payment requirement. Email is the free-first route. Optional physical-media production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WREK’s current Music page links directly to its official submission guidance, which authorizes music delivery by email to music.director@wrek.org or by postal mail and states that independently produced music is accepted. The guidance does not publish current digital attachment-versus-link rules, file-size limits, required metadata, international eligibility, explicit-content rules, release timing or AI-origin policy. Its postal address also conflicts with other official WREK address representations. A human must first confirm the current digital delivery method and, if physical delivery is considered, confirm the correct address. Do not send unsolicited large attachments, guess alternative contacts, automate any protected workflow or use email and post as duplicate routes.',
    notes:
      'Verified on 2026-07-16 from WREK’s current official homepage and Music page plus the currently linked official submission guidance on old.wrek.org. The guidance publishes music.director@wrek.org twice, explicitly authorizes email or snail-mail music submissions, says WREK can handle common music media formats, notes that CDs and LPs have a better chance of airplay, and confirms that independently produced music is accepted. The mailbox has valid syntax, an exact wrek.org domain match and an explicit Music Director submission purpose. Current operation was confirmed through 24/7 broadcasting language, a current player and official playlists/posts dated July 10 and July 15, 2026. WREK’s current Music page lists electronic, ambient, experimental, hip-hop, reggae, international and world-oriented programming. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, attachment, link, physical package, form field, login, CAPTCHA, consent or payment was submitted.'
  }
];
