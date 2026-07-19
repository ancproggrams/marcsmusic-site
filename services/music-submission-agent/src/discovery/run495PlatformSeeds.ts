import type { PlatformInput } from '../models/types.js';
import { run496SeedPlatforms } from './run496PlatformSeeds.js';

const run495NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "Rhythm House Uplifting Drum & Bass Private-Link Demo Form",
    "websiteUrl": "https://rhythm-house.co.uk/",
    "submissionUrl": "https://rhythm-house.co.uk/#demos",
    "sourceUrl": "https://rhythm-house.co.uk/",
    "sourceType": "automation_run_495_public_research",
    "country": "United Kingdom / newly established independent drum-and-bass label founded in 2026; the public form does not state a territory restriction, but universal international eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "drum and bass",
      "uplifting drum and bass",
      "dancefloor drum and bass",
      "private SoundCloud link",
      "private Dropbox link",
      "first-party form",
      "manual-review"
    ],
    "submissionMethod": "official first-party form requesting artist name, email, a private SoundCloud or Dropbox link and an optional message",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or release fee is visible on the official demo form.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Drum-and-bass fit, private-link access, release status, master/composition/sample/contributor rights, Content ID, AI policy, privacy and retention, hidden or submit-time anti-spam controls, post-selection contract terms and the final form action require human review.",
    "notes": "Passively verified on 2026-07-19 from Rhythm House's official first-party website. The label seeks uplifting, dancefloor-focused drum and bass with strong production and identity. The form visibly requests name, email, a private SoundCloud or Dropbox link and an optional message, and states that the label listens to everything and aims to respond within four weeks when there is a fit. The site lists RH001, Krakota - Hold On, released May 29, 2026, and also presents Monochord - Lifeline as RH002 dated June 26, 2026. bookings@krakota.com is first-party published as booking contact for the founder, syntactically valid but not domain-aligned and not authorized as a demo substitute. No form field, private link, login, CAPTCHA, payment or submission was used."
  },
  {
    "name": "Beat Intelligence Network Bass-Music Label Demo Form",
    "websiteUrl": "https://www.dubstepfbi.com/beat-intelligence-network",
    "submissionUrl": "https://www.dubstepfbi.com/beat-intelligence-network",
    "sourceUrl": "https://www.dubstepfbi.com/beat-intelligence-network",
    "sourceType": "automation_run_495_public_research",
    "country": "United States / Dubstep FBI-operated bass-music imprint with international releases and 2026 European activity; the demo page does not expressly guarantee universal international eligibility.",
    "language": "en",
    "genres": [
      "dubstep",
      "riddim",
      "bass music",
      "melodic dubstep",
      "heavy bass",
      "song URL",
      "first-party form",
      "manual-review"
    ],
    "submissionMethod": "official first-party label form requesting name, email and a URL to one or more songs for possible signing",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or signing fee is visible on the official label demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Bass-music and catalogue fit, URL access and downloadability, track/release status, master/composition/sample/contributor rights, Content ID, AI policy, privacy and retention, hidden Wix or submit-time anti-spam controls, post-selection contract terms and the final form action require human review.",
    "notes": "Passively verified on 2026-07-19 from Beat Intelligence Network and Dubstep FBI first-party pages. The label page invites rising, local and established talent across the bass-music spectrum and exposes a form with Name, Email and URL fields; it only replies when interested in signing. Activity is current: Dubstep FBI's July 2026 coverage identifies SweetTooth and Sora's Digital Gooning as a Beat Intelligence Network release dated July 10, 2026, and documents the label's 2026 Rampage Open Air presence. exec@dubstepfbi.com is first-party published, syntactically valid and domain-aligned, but is explicitly for advertising and partnerships, not a demo substitute. No form field, song URL, account, CAPTCHA, payment or submission was used."
  },
  {
    "name": "Us & Machines Worldwide House / EDM Demo Upload",
    "websiteUrl": "https://usandmachines.com/",
    "submissionUrl": "https://usandmachines.com/demos",
    "sourceUrl": "https://usandmachines.com/demos",
    "sourceType": "automation_run_495_public_research",
    "country": "United States / California electronic label; the official releases page explicitly invites artists worldwide.",
    "language": "en",
    "genres": [
      "house",
      "tech house",
      "progressive house",
      "deep house",
      "bass house",
      "techno",
      "electronic dance music",
      "direct audio upload",
      "private SoundCloud link",
      "Suno/AI disclosure",
      "first-party form",
      "manual-review"
    ],
    "submissionMethod": "official first-party form accepting either a direct track upload or private SoundCloud link plus artist, title, vocal-source, email, location and optional social-profile details",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or release fee is visible on the official demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "House/EDM catalogue fit, file type and size limits, direct-upload or private-link access, vocal-source and Suno/AI disclosure, release status, master/composition/sample/contributor rights, Content ID, privacy and retention, hidden or submit-time controls, post-selection contract terms and the final upload/form action require human review.",
    "notes": "Passively verified on 2026-07-19 from Us & Machines' official demo, releases and terms pages plus current catalogue evidence. The form accepts a direct upload or private SoundCloud link and visibly requests artist name, track title, email, city/country and social links. It expressly asks whether vocals are Original, from a Sample Pack or Suno/AI, making AI-origin disclosure a required fit check rather than a published ban. The releases page invites artists worldwide and lists house, tech house, progressive house, deep house and EDM. Activity is current: Beatport lists AMT High by Wolf Story on July 3, 2026, and the label's Inertia Vol. 1 compilation was scheduled for July 17, 2026. info@usandmachines.com is first-party published, syntactically valid and domain-aligned, but is general contact and not a demo-form substitute. No file, link, form field, login, CAPTCHA, payment or submission was used."
  }
];

export const run495SeedPlatforms: PlatformInput[] = [
  ...run495NewSeedPlatforms,
  ...run496SeedPlatforms
];
