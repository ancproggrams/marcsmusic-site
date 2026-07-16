import type { PlatformInput } from '../models/types.js';

export const run392SeedPlatforms: PlatformInput[] = [
  {
    name: 'CJSF 90.1 FM National Music Director Submission Route',
    websiteUrl: 'https://www.cjsf.ca/',
    submissionUrl: 'https://www.cjsf.ca/contact-us/departments/music-department',
    sourceUrl: 'https://www.cjsf.ca/contact-us/departments/music-department',
    sourceType: 'automation_run_392_public_research',
    country: 'Canada / Burnaby, British Columbia campus-community radio',
    language: 'en',
    genres: [
      'campus-radio',
      'community-radio',
      'independent-music',
      'electronic',
      'hip-hop',
      'world-music',
      'experimental',
      'national-distribution',
      'public-form',
      'public-business-email',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-national-music-director-form-or-music-coordinator-email-route',
    feeRequired: false,
    feeAmount:
      'No submission fee is stated for CJSF’s own first-party Music Department form or published Music Coordinator email. The separately promoted !earshot Distro platform is paid and account-gated and is not approved as part of this free-first route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CJSF expressly invites music submissions through its National Music Director form and publishes cjsfmusc@sfu.ca for direct music delivery. The page requires the submitter to hold and grant broadcast rights; excludes singles from CJSF’s local library; restricts physical submissions to releases local to specified British Columbia communities; and states that releases may be shared with participating Canadian campus and community stations. The current live form fields, upload or link method, accepted audio formats, file-size limits, consent controls, CAPTCHA or anti-spam state, international eligibility, AI-origin policy and explicit-content requirements are not fully exposed. A human must reopen the official page, inspect the live form without bypassing controls, confirm that a non-Canadian MarcsMusic EP or album is eligible, choose either the form or cjsfmusc@sfu.ca once, and provide only rights-cleared material in the requested format. Do not use the paid/account-gated !earshot Distro route, non-local physical delivery, or parallel staff contacts without separate approval.',
    notes:
      'Verified on 2026-07-16 from CJSF’s official Music Department, Submissions, Contact and homepage pages. The Music Department page invites completion of its National Music Director form, states that submitted releases are made available to CJSF programmers and participating non-profit Canadian stations, requires broadcast-rights authority, excludes singles from CJSF’s local library and refuses non-local physical submissions. The station’s general Submissions page and Contact page publish cjsfmusc@sfu.ca for music submissions and identify Connor Ashton as Music Coordinator. The mailbox has valid syntax and uses Simon Fraser University’s institutional sfu.ca domain. Current operation was confirmed through a live player, programmes aired through July 15, 2026, a Summer 2026 recruitment notice and current programme pages. No form field, email, audio asset, attachment, link, account, login, CAPTCHA, consent or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  }
];
