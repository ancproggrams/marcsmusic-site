import type { PlatformInput } from '../models/types.js';
import { run481SeedPlatforms } from './run481PlatformSeeds.js';

const run480NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "PBS 106.7FM International Music Submission",
    "websiteUrl": "https://www.pbsfm.org.au/",
    "submissionUrl": "https://www.pbsfm.org.au/submitmusic",
    "sourceUrl": "https://www.pbsfm.org.au/submitmusic",
    "sourceType": "automation_run_480_public_research",
    "country": "Australia / Melbourne community FM, digital and online station; the official submission page expressly welcomes local and international acts.",
    "language": "en",
    "genres": [
      "electronic",
      "hip-hop",
      "reggae",
      "dub",
      "world",
      "global",
      "soul",
      "funk",
      "jazz",
      "experimental",
      "independent",
      "AAC",
      "MP3",
      "WAV",
      "download-link",
      "manual-review"
    ],
    "submissionMethod": "official first-party public form using a stream link and a high-quality downloadable audio link for presenter-led editorial airplay consideration",
    "feeRequired": false,
    "feeAmount": "No mandatory submission fee or payment is published for the official digital form; optional station membership and physical delivery are separate.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "International form fields, 320 kbps AAC/MP3 or WAV download quality, stream/link permissions, rights, AI eligibility, privacy and licence terms, optional newsletter consent, visible CAPTCHA/honeypot and the final submission require human approval.",
    "notes": "Passively verified on 2026-07-18 from the official submission, contact, homepage, current programme and July 2026 news/event pages. PBS expressly welcomes local and international acts and asks for a stream plus a high-quality download; Spotify and Deezer links are rejected. The form exposes a honeypot and human-verification CAPTCHA, which were not completed or bypassed. The current canonical route is the form. musicdept@pbsfm.org.au was first-party published in a 2018 staff announcement, but current mailbox status was not independently reconfirmed and it was not substituted for the form. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No field was filled, no link was shared, no physical media was mailed, no marketing consent was given and no payment or submission action was performed."
  },
  {
    "name": "Brum Radio Specialist-Show Music Submission",
    "websiteUrl": "https://brumradio.com/",
    "submissionUrl": "https://brumradio.com/submissions/",
    "sourceUrl": "https://brumradio.com/submissions/",
    "sourceType": "automation_run_480_public_research",
    "country": "United Kingdom / Birmingham independent 24/7 online station; non-local artists are expressly considered for specialist shows, while the main playlist is limited to Birmingham and the West Midlands.",
    "language": "en",
    "genres": [
      "electronic",
      "dance",
      "bass",
      "reggae",
      "world",
      "Afro",
      "soul",
      "chill",
      "experimental",
      "indie",
      "MP3",
      "WAV",
      "direct-upload",
      "manual-review"
    ],
    "submissionMethod": "official first-party public one-track upload form, supported by a domain-aligned music-submission mailbox, for weekly editorial review",
    "feeRequired": false,
    "feeAmount": "No mandatory submission fee or payment is published for the official form or music-submission mailbox.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Main-playlist geography versus non-local specialist-show fit, one clean radio edit, direct upload, MP3/WAV quality and limits, rights, AI eligibility, privacy/licence terms, possible hidden anti-spam controls and final form submission require human approval.",
    "notes": "Passively verified on 2026-07-18 from the official submission, contact, show, schedule, player and current volunteer-role pages. The form accepts one MP3 at 192 kbps or higher or WAV, prefers a radio edit under 4:30, rejects Spotify and YouTube links, and requires clean-content confirmation. submissions@brumradio.com is first-party published, syntactically valid, domain-aligned and explicitly labelled Submit Music. General, press and advertising addresses were excluded. No visible CAPTCHA appeared in passive indexing, but hidden or submit-time verification remains unconfirmed. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email was sent, no form field was filled, no file was uploaded and no payment or submission action was performed."
  },
  {
    "name": "Radio Nano International Music Submission",
    "websiteUrl": "https://radionano.com/",
    "submissionUrl": "https://radionano.com/submit-your-music/",
    "sourceUrl": "https://radionano.com/submit-your-music/",
    "sourceType": "automation_run_480_public_research",
    "country": "Norway / independent online contemporary-hit and pop-classics station; the official submission page expressly invites local and international acts.",
    "language": "en",
    "genres": [
      "pop",
      "dance",
      "EDM",
      "electronic",
      "contemporary hit radio",
      "pop classics",
      "international",
      "MP3",
      "audio-link",
      "direct-upload",
      "manual-review"
    ],
    "submissionMethod": "official first-party public Contact Form 7 route with upload or song URL, plus an explicit domain-aligned alternative music-submission mailbox",
    "feeRequired": false,
    "feeAmount": "No mandatory submission fee or payment is published for the official form or email route.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Form-versus-email route choice, audio upload or link quality, biography/press release, all rightsholder permissions, AI eligibility, upload limits, privacy/licence/retention terms, possible hidden Contact Form 7 anti-spam controls and final send require human approval.",
    "notes": "Passively verified on 2026-07-18 from the official submission, privacy, about, chart, event and news pages. Radio Nano expressly welcomes local and international acts and requires permission from all rightsholders and contributors, including for covers and samples. music@radionano.com is first-party published, syntactically valid, domain-aligned and explicitly designated for music submissions. privacy@radionano.com is a privacy contact only. No visible CAPTCHA appeared in passive indexing; hidden Contact Form 7 or submit-time controls remain unconfirmed. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email was sent, no form field was filled, no file or biography was uploaded or attached and no payment or submission action was performed."
  }
];

export const run480SeedPlatforms: PlatformInput[] = [
  ...run480NewSeedPlatforms,
  ...run481SeedPlatforms
];
