import type { PlatformInput } from '../models/types.js';

export const run394SeedPlatforms: PlatformInput[] = [
  {
    name: 'WRMC 91.1 FM Music Directors Process Inquiry Route',
    websiteUrl: 'https://wrmc.middlebury.edu/',
    submissionUrl: 'https://wrmc.middlebury.edu/about',
    sourceUrl: 'https://wrmc.middlebury.edu/about',
    sourceType: 'automation_run_394_public_research',
    country: 'United States / Middlebury, Vermont student-run college radio',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'alternative',
      'electronic',
      'hip-hop',
      'rap',
      'world-music',
      'indie',
      'public-business-email',
      'asset-free-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-directors-asset-free-process-inquiry',
    feeRequired: false,
    feeAmount:
      'No submission fee, login or mandatory payment is stated for contacting WRMC’s publicly listed Music Directors. The route is authorized only for an asset-free process inquiry until WRMC confirms its current music-delivery procedure.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WRMC’s official About page publicly identifies Cate Richardson and Honor McFadden as Music Directors and publishes crichardson@middlebury.edu and hmcfadden@middlebury.edu. The station does not publish an unsolicited-music submission form or current delivery specifications on the reviewed first-party pages. A human may send one concise, asset-free inquiry to the Music Director function asking whether external and international artists are accepted and requesting the authorized format, link, metadata, release-window, clean-edit and AI-origin requirements. Do not attach audio, provide private links, contact both directors separately, infer a postal route, use individual DJs or send a release until WRMC expressly confirms the procedure.',
    notes:
      'Verified on 2026-07-16 from WRMC’s official homepage, About page, schedule, charts and library pages. The About page lists the two current Music Directors and their institutional middlebury.edu addresses in plaintext. Both addresses have valid syntax and exact alignment with Middlebury College’s official domain; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. Current operation was confirmed through the live player/current-show interface, current playlist/chart data and an active weekly schedule containing electronic, rap, hip-hop, world, pop, indie, alternative and other programming. No public music-submission form, attachment policy, download-link specification, international eligibility rule, explicit-content policy, AI-origin policy or physical-delivery authorization was found. No email, form field, audio asset, link, login, CAPTCHA or payment was entered or submitted.'
  }
];
