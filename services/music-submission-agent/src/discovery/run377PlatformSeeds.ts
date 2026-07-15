import type { PlatformInput } from '../models/types.js';

export const run377SeedPlatforms: PlatformInput[] = [
  {
    name: 'KVRX 91.7 FM Authorized Music Department Submission',
    websiteUrl: 'https://www.kvrx.org/app/',
    submissionUrl: 'mailto:music@kvrx.org',
    sourceUrl: 'https://www.kvrx.org/app/contact/',
    sourceType: 'automation_run_377_public_research',
    country: 'United States / Austin, Texas student radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'experimental',
      'hip-hop',
      'world-music',
      'freeform',
      'student-radio',
      'digital-submission',
      'physical-submission',
      'manual-review'
    ],
    submissionMethod: 'official-public-music-department-email-and-physical-mail',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated on the official contact page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KVRX explicitly accepts digital and physical submissions through its Music Department, but it rejects AI-assisted or AI-generated music. A human must establish the selected MarcsMusic release production provenance, confirm that it is eligible under KVRX policy, verify current digital delivery format, attachment or download-link rules, metadata and international eligibility, and submit manually only if compliant. Do not use the separate operations mailbox as a substitute unless asking a genuine submission-policy question.',
    notes:
      'Verified on 2026-07-15 from KVRX 91.7 FM’s official contact page. The station publishes music@kvrx.org for airplay consideration, operations@kvrx.org only for other submission questions, and states that both physical and digital submissions are currently accepted. The page also explicitly says AI-assisted/generated music will not be considered. The official homepage showed a live on-air automation state and described continuous underground, live and local programming. No email, file, link, physical package, login, CAPTCHA, consent or payment was submitted.'
  },
  {
    name: 'KALX 90.7 FM Authorized Physical Music Submission',
    websiteUrl: 'https://kalx.berkeley.edu/',
    submissionUrl: 'https://kalx.berkeley.edu/about/contact/',
    sourceUrl: 'https://kalx.berkeley.edu/about/contact/',
    sourceType: 'automation_run_377_public_research',
    country: 'United States / Berkeley, California college and community radio',
    language: 'en',
    genres: [
      'freeform',
      'electronic',
      'jungle',
      'techno',
      'house',
      'experimental',
      'industrial',
      'world-music',
      'underground-hip-hop',
      'college-radio',
      'physical-submission',
      'manual-review'
    ],
    submissionMethod: 'official-physical-cd-or-lp-mail-route',
    feeRequired: false,
    feeAmount:
      'No editorial fee is stated. International postage, manufacturing and customs costs may apply and require human approval.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KALX currently accepts only professionally pressed physical CDs or LPs for airplay consideration and explicitly rejects downloads, file transfers, streaming links, YouTube, CD-Rs and other digital delivery. A human must confirm international eligibility, select an eligible professionally manufactured release, approve manufacturing, postage and customs costs, verify package metadata and rights, and mail it manually. Music must not be emailed to the Music Directors or adjacent staff addresses.',
    notes:
      'Verified on 2026-07-15 from KALX’s official contact page. The station identifies Music Directors Dasha Shevchenko and Ava Hoener and publishes music@kalx.berkeley.edu, but its stated submission route is physical mail addressed to the Music Director. The same page explicitly excludes digital delivery. KALX’s official homepage displayed current live playlist and July 2026 scheduling, and its specialty-program page lists electronic, jungle, techno, house, experimental, world and underground hip-hop programming. No email, attachment, stream, download, physical package, login, CAPTCHA, consent or payment was submitted.'
  }
];
