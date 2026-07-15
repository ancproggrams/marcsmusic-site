import type { PlatformInput } from '../models/types.js';

export const run383SeedPlatforms: PlatformInput[] = [
  {
    name: 'WONY 90.9FM Music Director Airplay Submission Route',
    websiteUrl: 'https://www.wonyfm.org/',
    submissionUrl: 'https://www.wonyfm.org/music-department',
    sourceUrl: 'https://www.wonyfm.org/music-department',
    sourceType: 'automation_run_383_public_research',
    country: 'United States / Oneonta, New York SUNY student-run college radio',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-music',
      'new-music',
      'electronic',
      'alternative',
      'hip-hop',
      'world-music',
      'music-director',
      'manual-review'
    ],
    submissionMethod: 'official-public-protected-music-director-contact-route',
    feeRequired: false,
    feeAmount: 'No submission fee is stated on the official Music Department page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WONY explicitly invites artists to use the current Music Director contact to submit music for airplay, but the destination is exposed only through a non-plaintext contact link and the official pages do not publish attachment-versus-link rules, accepted formats, metadata, release timing, international eligibility, explicit-content handling or AI-origin policy. A human must use the official contact link without decoding or guessing it, confirm the current requirements, permission-check the selected assets and complete any outreach manually.',
    notes:
      'Verified on 2026-07-15 from WONY’s official homepage, Music Department page and Contact page. The 2025–2026 board identifies Jesse Woodhouse as Music Director, and the Music Department page expressly says to contact Jesse to submit music for airplay. The protected or non-plaintext destination was not decoded or stored. The general wonygm@gmail.com mailbox and published postal address were excluded as substitute submission routes. Current activity is evidenced by the live and currently-playing surface, more than two dozen live DJs each week, the 2025–2026 board and © 2026 pages. No email, form field, file, link, login, CAPTCHA, consent or payment was entered or submitted.'
  }
];
