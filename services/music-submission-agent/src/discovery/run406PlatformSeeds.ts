import type { PlatformInput } from '../models/types.js';

export const run406SeedPlatforms: PlatformInput[] = [
  {
    name: 'KZSU Stanford 90.1 FM Digital and Physical Music Submission Route',
    websiteUrl: 'https://kzsu.stanford.edu/',
    submissionUrl: 'https://kzsu.stanford.edu/wnl/',
    sourceUrl: 'https://kzsu.stanford.edu/wnl/',
    sourceType: 'automation_run_406_public_research',
    country: 'United States / Stanford, California student-run freeform university radio with worldwide online streaming',
    language: 'en',
    genres: [
      'college-radio',
      'freeform-radio',
      'independent-music',
      'electronic',
      'hip-hop',
      'reggae',
      'world-music',
      'experimental',
      'noise',
      'jazz',
      'brazilian-samba',
      'cross-genre',
      'public-business-email',
      'authorized-digital-submission-route',
      'authorized-physical-submission-alternative',
      'temporary-cookie-session-guidelines',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-digital-email-with-cookie-session-guidelines-and-physical-delivery-alternative',
    feeRequired: false,
    feeAmount:
      'KZSU publishes no submission fee, account login or mandatory-payment requirement for its Music Department email route. Digital delivery is free-first. Optional physical-media production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KZSU’s official Contact page publishes music@kzsu.stanford.edu beside the current Music Directors and links “send us music.” Its official Wednesday Night Live page independently instructs artists seeking regular air rotation to review the guidelines and send a digital copy to that mailbox or mail physical media. The official guideline shortcut leads to a Zookeeper workflow requiring a temporary browser cookie and secure session; passive retrieval exposed no form fields and no CAPTCHA, account login or payment screen. A human must use the normal browser workflow without bypassing controls, confirm international eligibility, release types, delivery mechanics, formats, file limits, metadata, release timing, explicit-content and AI-origin requirements, select one genuinely suitable MarcsMusic release and use only one authorized route.',
    notes:
      'Verified on 2026-07-16 from KZSU’s official Contact, Wednesday Night Live, homepage, schedule and show-player/archive surfaces. The public Music Department mailbox was verified through first-party plaintext publication on two official pages, explicit submission purpose, valid syntax and exact kzsu.stanford.edu domain alignment; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. The Contact page identifies Binta Diallo, Juan Luna-Avin and Bill Cuevas as Music Directors and warns against indiscriminate multi-address emailing. Current operation was supported by the live on-air interface, three live streams, current department roster and operational schedule and archive tools. No email, guideline form, cookie session, audio file, attachment, link, physical package, login, CAPTCHA, consent or payment was submitted.'
  }
];
