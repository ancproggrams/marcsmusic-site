import type { PlatformInput } from '../models/types.js';

export const run360SeedPlatforms: PlatformInput[] = [
  {
    name: 'WFMU Freeform Radio Physical Music Review Route',
    websiteUrl: 'https://wfmu.org/',
    submissionUrl: 'https://wfmu.org/sendmusic.html',
    sourceUrl: 'https://wfmu.org/sendmusic.html',
    sourceType: 'automation_run_360_public_research',
    country: 'United States / Jersey City, New Jersey / independent freeform radio',
    language: 'en',
    genres: [
      'freeform',
      'independent',
      'electronic',
      'experimental',
      'ambient',
      'noise',
      'dub',
      'reggae',
      'world-music',
      'radio-airplay',
      'music-review',
      'physical-submission',
      'manual-review'
    ],
    submissionMethod: 'official-wfmu-physical-music-review-route-with-javascript-music-department-contact-form',
    feeRequired: false,
    feeAmount:
      'No submission fee or mandatory payment is stated. Media production, international postage, courier, customs and import costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WFMU explicitly welcomes vinyl, CD, CD-R and cassette materials for review and publishes USPS and UPS/FedEx delivery addresses for Music Director Jessica Romoff. A human must choose eligible physical media, reconfirm the current address, prepare customs and postage accurately, and decide whether the release is appropriate for WFMU freeform programming. The adjacent Music Department contact page requires JavaScript and its live validation or anti-abuse controls were not mapped, so it may be used only manually for a concise routing question and not for automated submission. Do not infer or guess a direct email address.',
    notes:
      'Verified on 2026-07-14 from WFMU official Send Music, Music Department contact and homepage pages. The station was actively publishing archives and playlists dated July 14, 2026 and describes itself as an independent freeform station. The first-party submission page names Jessica Romoff as Music Director and authorizes physical review copies at its Jersey City postal and courier addresses. No plaintext music-submission mailbox was exposed; the official contact route is a JavaScript-dependent form. No form, package, file, login, CAPTCHA, payment, SMTP, MX, catch-all or mailbox-level probe was performed.'
  },
  {
    name: 'KZSU Stanford Digital-or-Physical Music Rotation Submission Route',
    websiteUrl: 'https://kzsu.stanford.edu/',
    submissionUrl: 'https://kzsu.stanford.edu/contact/',
    sourceUrl: 'https://kzsu.stanford.edu/wnl/',
    sourceType: 'automation_run_360_public_research',
    country: 'United States / Stanford, California / Stanford University freeform radio',
    language: 'en',
    genres: [
      'freeform',
      'independent',
      'electronic',
      'experimental',
      'hip-hop',
      'reggae',
      'world-music',
      'college-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'music-director',
      'manual-review'
    ],
    submissionMethod: 'official-kzsu-music-director-digital-copy-or-physical-media-route',
    feeRequired: false,
    feeAmount:
      'No submission fee or mandatory payment is stated. Physical-media production, international postage and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KZSU publicly authorizes digital rotation submissions to music@kzsu.stanford.edu and publishes postal and courier addresses for physical music. A human must open the official guidelines immediately before outreach and verify current accepted release types, codecs, bitrate, attachment versus download-link rules, metadata, release window, international eligibility and any live anti-abuse controls. The guideline portal required a temporary cookie during passive inspection and the official go.kzsu.fm send-music shortcut returned a gateway error, so those boundaries must not be bypassed. Send to only the Music Director route and do not bulk-copy unrelated staff addresses.',
    notes:
      'Verified on 2026-07-14 from KZSU official Contact, Wednesday Night Live, homepage, schedule and featured-program pages. The Contact page names current Music Directors Binta Diallo, Juan Luna-Avin and Bill Cuevas and publishes music@kzsu.stanford.edu. The Wednesday Night Live page explicitly says regular-air-rotation submissions may be sent as a digital copy to that mailbox or mailed as physical media. Current operation was supported by the live on-air homepage, current staff directory and a featured program originally broadcast December 3, 2025. Email verification was limited to first-party publication, valid syntax, Stanford institutional-domain alignment and explicit Music Director purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed, and no email, file, form, cookie challenge, login, CAPTCHA, package or payment action was taken.'
  }
];
