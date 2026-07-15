import type { PlatformInput } from '../models/types.js';

export const run375SeedPlatforms: PlatformInput[] = [
  {
    name: 'RadioActive.FM 88.6 Music Submission Email and Postal Route',
    websiteUrl: 'https://www.radioactive.fm/',
    submissionUrl: 'https://www.radioactive.fm/contact/',
    sourceUrl: 'https://www.radioactive.fm/contact/',
    sourceType: 'automation_run_375_public_research',
    country: 'New Zealand / Wellington independent community radio',
    language: 'en',
    genres: [
      'alternative',
      'independent',
      'electronic',
      'electronica',
      'house',
      'techno',
      'bass-music',
      'dubstep',
      'drum-and-bass',
      'dub',
      'reggae',
      'hip-hop',
      'global-music',
      'community-radio',
      'email-submission',
      'physical-music-submission',
      'manual-review'
    ],
    submissionMethod: 'official-dedicated-music-email-or-authorized-postal-delivery',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'RadioActive.FM publishes music@radioactive.fm as its dedicated Music Submissions mailbox and also explicitly offers a postal music route, but the public page does not state accepted release types, file formats, attachment-versus-download-link rules, metadata, release windows, international eligibility, physical-copy quantities, explicit-content handling or AI-origin restrictions. A human must recheck the current guidance, select a suitable MarcsMusic release, prepare only permitted assets, choose either email or physical delivery, send manually, and stop if a login, CAPTCHA, payment, consent request or updated restriction appears.',
    notes:
      'Verified on 2026-07-15 from RadioActive.FM’s official Contact, About, homepage and programme pages. The Contact page lists music@radioactive.fm under “Music Submissions” and offers an alternative postal route using the published Wellington address. It separately lists general, programme, bookings, advertising and staff contacts; none were substituted for the dedicated music route. Activity was confirmed through official interviews and guest mixes dated 2026-07-13, 2026-07-08, 2026-07-02 and other June–July 2026 content, plus a current schedule and specialist programming. The station describes a broad eclectic remit and programmes electronic, indie and other specialist music. Email verification covered first-party publication, valid syntax, official radioactive.fm domain alignment and explicit submission purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, physical package, file, link, form, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'Radio Control 99.4FM Music Submission Email and Snail-Mail Route',
    websiteUrl: 'https://www.radiocontrol.org.nz/',
    submissionUrl: 'https://www.radiocontrol.org.nz/contact',
    sourceUrl: 'https://www.radiocontrol.org.nz/contact',
    sourceType: 'automation_run_375_public_research',
    country: 'New Zealand / Palmerston North student radio',
    language: 'en',
    genres: [
      'alternative',
      'independent',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'bass-music',
      'dub',
      'reggae',
      'hip-hop',
      'global-music',
      'student-radio',
      'email-submission',
      'physical-music-submission',
      'manual-review'
    ],
    submissionMethod: 'official-dedicated-music-email-or-authorized-snail-mail',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Radio Control publishes music@radiocontrol.org.nz specifically for Music Submissions and places a station snail-mail address directly beneath that route, but it does not publish current release-type, track-count, file-format, attachment-versus-link, metadata, release-window, international-eligibility, physical-copy, explicit-content or AI-origin requirements. A human must recheck the current guidance, confirm overseas eligibility, select a suitable MarcsMusic release, choose the permitted delivery method, send manually only through the dedicated route, and stop if a login, CAPTCHA, payment, consent request or updated restriction appears.',
    notes:
      'Verified on 2026-07-15 from Radio Control’s official Contact, homepage and About pages. The Contact page publishes music@radiocontrol.org.nz under “Music Submissions” and a dedicated snail-mail address immediately below it. Manager, programme, breakfast, volunteer and production addresses were retained only as adjacent business contacts and were not used as submission substitutes. The station states that it broadcasts 24/7 and streams worldwide, plays alternative music from Aotearoa and the rest of the world, and highlights current 2026 programming including 100% NZ Music Week from 2026-05-25 through 2026-05-31, weekly charts and live sessions. Email verification covered first-party publication, valid syntax, official radiocontrol.org.nz domain alignment and explicit submission purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, physical package, file, link, form, login, CAPTCHA or payment was submitted.'
  }
];