import type { PlatformInput } from '../models/types.js';
import { run484SeedPlatforms } from './run484PlatformSeeds.js';

const run483NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "WXDU 88.7 FM Airplay Submission",
    "websiteUrl": "https://www.wxdu.org/",
    "submissionUrl": "https://www.wxdu.org/contact",
    "sourceUrl": "https://www.wxdu.org/contact",
    "sourceType": "automation_run_483_public_research",
    "country": "United States / Duke University non-commercial FM and online station in Durham, North Carolina; the official route does not expressly confirm international-artist eligibility.",
    "language": "en",
    "genres": [
      "independent",
      "alternative",
      "experimental",
      "electronic",
      "RPM",
      "world",
      "Latin",
      "jazz",
      "Americana",
      "LOUD",
      "Bandcamp",
      "YUM-code",
      "download-link",
      "email",
      "manual-review"
    ],
    "submissionMethod": "official first-party public music-submission mailbox preferring Bandcamp YUM codes over other downloads",
    "feeRequired": false,
    "feeAmount": "No mandatory submission fee or payment is published for the official route.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "International eligibility, programme fit, Bandcamp/download access, rights and Content ID, AI policy, licence/privacy/retention terms and the final email send require human approval.",
    "notes": "Passively verified on 2026-07-18 from the official contact, Summer 2026 schedule and rolling ten-day playlist pages. music@wxdu.org is first-party published, syntactically valid, domain-aligned and explicitly designated for music submissions; Bandcamp YUM codes are preferred. International eligibility, detailed technical requirements, AI policy and submission-specific licence/privacy terms are not published. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email was sent and no code, file or link was shared."
  },
  {
    "name": "Hot Wax Radio Indie Music Submission",
    "websiteUrl": "https://hotwaxradio.com/wp/",
    "submissionUrl": "https://hotwaxradio.com/wp/submit-music/",
    "sourceUrl": "https://hotwaxradio.com/wp/submit-music/",
    "sourceType": "automation_run_483_public_research",
    "country": "United States / Illinois-based 24/7 online station with worldwide independent-artist positioning and global streaming reach.",
    "language": "en",
    "genres": [
      "independent",
      "reggae",
      "world",
      "techno",
      "electronica",
      "house",
      "trance",
      "dance",
      "pop",
      "alternative",
      "rock",
      "Dropbox",
      "Google Drive",
      "MP3",
      "form",
      "manual-review"
    ],
    "submissionMethod": "official first-party JavaScript-dependent form using Dropbox or Google Drive MP3 links for editorial airplay consideration",
    "feeRequired": false,
    "feeAmount": "No mandatory submission fee or payment is published for the official route.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Genre fit, hard AI prohibition, cloud MP3 delivery, rights, promotional/podcast scope, royalty waiver, third-party releases, JavaScript controls, optional paid services and final submission require human approval.",
    "notes": "Passively verified on 2026-07-18 from the official submission, terms/privacy, schedule, homepage, about and anniversary pages, with July 2026 public playlist evidence. The route accepts only cloud-delivered MP3s in stated genres, rejects AI submissions and ties form use to broad promotional distribution and royalty-waiver terms. patrick@relaxmusicgroup.com is an official media contact but not a submission mailbox. The JavaScript form's live fields and hidden controls were not completed or bypassed. No link, file, consent, payment or submission was provided."
  },
  {
    "name": "Zaccone Music / Music Therapy Demo Submission",
    "websiteUrl": "https://www.zaccone-music.it/",
    "submissionUrl": "https://www.zaccone-music.it/",
    "sourceUrl": "https://www.zaccone-music.it/",
    "sourceType": "automation_run_483_public_research",
    "country": "Italy / Europe-based independent electronic label working with DJs and producers worldwide and explicitly inviting international demos.",
    "language": "en",
    "genres": [
      "electronic",
      "Afro House",
      "Melodic House",
      "Progressive House",
      "Melodic Techno",
      "SoundCloud",
      "private-link",
      "email",
      "label-demo",
      "manual-review"
    ],
    "submissionMethod": "official first-party demo form/mailbox using a private SoundCloud or other valid music link for international label review",
    "feeRequired": false,
    "feeAmount": "No mandatory submission fee or payment is published for the official route.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Electronic subgenre and label fit, private-link access, rights, AI policy, privacy/retention, newsletter separation, possible contract terms and the final form/email action require human approval.",
    "notes": "Passively verified on 2026-07-18 from the official 2026 label/demo page and 2026 Beatport release records. music@zaccone-music.it is first-party published, syntactically valid, domain-aligned and explicitly designated for demos. The label works internationally and requests a private SoundCloud or valid music link, but publishes no detailed AI, rights, privacy, retention or contract terms for demos. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No form field was filled, no link was shared and no email or submission was sent."
  }
];

export const run483SeedPlatforms: PlatformInput[] = [
  ...run483NewSeedPlatforms,
  ...run484SeedPlatforms
];
