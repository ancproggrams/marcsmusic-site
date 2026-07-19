import type { PlatformInput } from '../models/types.js';
import { run497SeedPlatforms } from './run497PlatformSeeds.js';

const run496NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "Protocol Zero European Drum & Bass / Neurofunk Demo Email",
    "websiteUrl": "https://protocolzero.online/",
    "submissionUrl": "mailto:demo@protocolzero.online",
    "sourceUrl": "https://protocolzero.online/",
    "sourceType": "automation_run_496_public_research",
    "country": "Slovakia / Italy / independent European drum-and-bass label; no territory restriction is published, but universal international eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "drum and bass",
      "neurofunk",
      "techstep",
      "dark drum and bass",
      "private SoundCloud link",
      "email submission",
      "manual-review"
    ],
    "submissionMethod": "official first-party demo mailbox requesting a private SoundCloud link",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or release fee is visible on the official label website.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Drum-and-bass/neurofunk catalogue fit, private-link access, download permission, release status, master/composition/sample/contributor rights, Content ID, AI policy, privacy and retention, post-selection contract terms and the final email action require human review.",
    "notes": "Passively verified on 2026-07-19 from Protocol Zero's official first-party website and current catalogue evidence. The label describes a European drum-and-bass and neurofunk focus spanning deep neurofunk and atmospheric techstep and explicitly authorizes demo submissions by private SoundCloud link to demo@protocolzero.online. The mailbox is first-party published, syntactically valid, domain-aligned and explicitly intended for demos. Activity is current: the official site presents Ominate - Command as the newest release, and Beatport lists Command under Protocol Zero with a July 11, 2026 release date. No email, link, attachment, account, CAPTCHA, payment or submission was used."
  },
  {
    "name": "Quantum Circle Records Private-SoundCloud Demo Form",
    "websiteUrl": "https://qcrecords.com/",
    "submissionUrl": "https://qcrecords.com/demo",
    "sourceUrl": "https://qcrecords.com/demo",
    "sourceType": "automation_run_496_public_research",
    "country": "Switzerland / independent underground electronic label; the demo page publishes no country restriction, but universal international eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "melodic house and techno",
      "tech house",
      "electro breakbeat",
      "underground electronic",
      "private SoundCloud link",
      "hard AI prohibition",
      "visible verification code",
      "first-party form",
      "manual-review"
    ],
    "submissionMethod": "official first-party form requesting artist name, email, private SoundCloud link and short message, protected by an image verification code",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or release fee is visible on the official demo page.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "The visible image verification code must be completed by a human. Catalogue fit, maximum-three-track limit, private-link access and downloads, unreleased/unshared status, WAV 44.1-kHz/16-bit minimum, hard no-AI rule, rights and samples, Content ID, privacy, post-selection terms and the final form action also require manual review.",
    "notes": "Passively verified on 2026-07-19 from Quantum Circle Records' official demo, homepage and release pages plus Beatport catalogue evidence. The canonical first-party form allows a maximum of three unreleased and unshared tracks, requires a private SoundCloud link with downloads enabled, specifies WAV at 44.1 kHz and 16-bit minimum, rejects attachments and expressly prohibits AI-generated music. The form exposes Artist Name, Artist e-mail, SoundCloud private link, Short message and a visible image Verification Code. demo@qcrecords.com is first-party published, syntactically valid and domain-aligned, but the page limits the email alternative to artists already in contact with the label; it is not a general replacement for the form. Activity is current: Beatport lists Hybridised on May 15, 2026 and a 2026 remaster released January 9, 2026. No form field, verification code, link, email, login, payment or submission was used."
  },
  {
    "name": "ACTIVATED Records Worldwide Hard-Dance WAV / MP3 Demo Upload",
    "websiteUrl": "https://activated-records.com/",
    "submissionUrl": "https://activated-records.com/demo.html",
    "sourceUrl": "https://activated-records.com/demo.html",
    "sourceType": "automation_run_496_public_research",
    "country": "Germany / ACTIVATED Network hard-dance label with artists and reach across Europe, Asia, Australia and the Americas.",
    "language": "en/de",
    "genres": [
      "hardstyle",
      "rawstyle",
      "x-raw",
      "hard techno",
      "rave",
      "uptempo",
      "frenchcore",
      "hardcore",
      "gabber",
      "reverse bass",
      "crossbreed",
      "direct WAV upload",
      "direct MP3 upload",
      "first-party form",
      "manual-review"
    ],
    "submissionMethod": "official first-party form requiring a WAV or MP3 upload up to 100 MB, with optional streaming/cloud link, artist/contact details, mandatory terms/privacy acceptance and optional newsletter consent",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or release fee is visible on the official demo route.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Direct file upload, exact hard-dance fit, file format and size, track metadata, rights and samples, Content ID, AI policy, required terms/privacy acceptance, demo-email retention and targeted contact-list use, optional newsletter consent, hidden anti-abuse controls, post-selection terms and the final form action require human review.",
    "notes": "Passively verified on 2026-07-19 from ACTIVATED Records' official demo, homepage, releases, legal-notice and privacy pages plus current Beatport evidence. The form requires first name, artist name, contact email plus confirmation, track title, genre/style and a WAV or MP3 upload up to 100 MB. Phone/WhatsApp, streaming/cloud link, social links and notes are optional. The newsletter checkbox is optional, while acceptance of the Terms and Privacy Policy is mandatory. The privacy policy says demo email addresses are stored in an internal demo-submitter contact list for feedback, special submission calls and relevant label information; demo audio files are automatically deleted after 30 days, and IP addresses are collected for abuse protection. k.schroetter@activated-network.com and info@activated-network.com are first-party published, syntactically valid and organizationally domain-aligned, but they are management/general contacts and not replacements for the demo form. Activity is current: Beatport lists Heart Of A Lion on June 12, 2026 and multiple other 2026 hard-dance releases; the official releases hub states it is updated continuously. No field, file, consent, email, CAPTCHA, login, payment or submission was used."
  }
];

export const run496SeedPlatforms: PlatformInput[] = [
  ...run496NewSeedPlatforms,
  ...run497SeedPlatforms
];
