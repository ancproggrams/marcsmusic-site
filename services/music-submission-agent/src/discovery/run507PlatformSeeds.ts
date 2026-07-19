import type { PlatformInput } from '../models/types.js';
import { run508SeedPlatforms } from './run508PlatformSeeds.js';

const run507NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "OX Recordings Drum & Bass / Neurofunk Demo Email",
    "websiteUrl": "https://oxrecordings.com/",
    "submissionUrl": "mailto:demos@oxrecordings.com",
    "sourceUrl": "https://oxrecordings.com/contacts/",
    "sourceType": "automation_run_507_public_research",
    "country": "Italy / independent Drum & Bass and Neurofunk label with worldwide digital distribution; the public route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "drum and bass",
      "neurofunk",
      "unreleased music",
      "finished tracks",
      "private SoundCloud",
      "private streaming link",
      "no email attachments"
    ],
    "submissionMethod": "Official first-party demo mailbox. Email demos@oxrecordings.com with a private full-track SoundCloud or other streaming link, a brief introduction and track description. Send only finished, unpublished music. Do not attach the audio file and do not send the demo to other addresses.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission or release fee is published on the official first-party contact and demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Drum-and-bass/neurofunk catalogue fit, finished and unpublished status, private-link access, introduction and track-description quality, rights and samples, Content ID, AI-origin disclosure, email privacy/retention, possible post-selection contract and the final email require human review."
  },
  {
    "name": "Sonaxx Records Hard Techno / Schranz Demo Form",
    "websiteUrl": "https://www.sonaxxrecords.com/",
    "submissionUrl": "https://www.sonaxxrecords.com/en/contact-and-demos",
    "sourceUrl": "https://www.sonaxxrecords.com/en/contact-and-demos",
    "sourceType": "automation_run_507_public_research",
    "country": "Switzerland / internationally distributed Hard Techno, Techno, Industrial and Schranz label; the public demo page does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "hard techno",
      "techno",
      "industrial",
      "schranz",
      "hard dance",
      "private SoundCloud",
      "Dropbox",
      "WeTransfer",
      "MP3 320kbps",
      "WAV"
    ],
    "submissionMethod": "Official first-party contact-and-demo form only. Submit complete MP3 320kbps or WAV tracks through private SoundCloud, Dropbox, WeTransfer or similar private links, or upload MP3 files directly. The form exposes multiple link and MP3-upload fields, with a displayed 15MB limit per upload field. Demos sent by email or social media are not considered. Music must not have been publicly accessible and should be shared only with Sonaxx.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission or release fee is published on the official demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Hard-techno/Schranz catalogue fit, complete-track and private-never-public status, exclusive sharing language, choice of direct MP3 upload versus private link, 15MB upload limits, privacy acknowledgement, rights and samples, Content ID, AI-origin disclosure, hidden anti-spam or submit-time controls, seven-day no-response rejection rule, post-selection contract and the final form require human review."
  },
  {
    "name": "Get Known Radio Global Electronic / Hip-Hop Airplay Submission",
    "websiteUrl": "https://getknownradio.com/",
    "submissionUrl": "https://getknownradio.com/submit-music.html",
    "sourceUrl": "https://getknownradio.com/submit-music.html",
    "sourceType": "automation_run_507_public_research",
    "country": "United States / New York-based independent 24/7 internet radio station with collaborators in Detroit and London; the official submission page explicitly accepts non-US artists without geographic restriction.",
    "language": "en",
    "genres": [
      "electronic",
      "drum and bass",
      "house",
      "UK garage",
      "Jersey club",
      "footwork",
      "baile funk",
      "amapiano",
      "hip-hop",
      "R&B",
      "MP3 320kbps",
      "WAV",
      "direct audio upload"
    ],
    "submissionMethod": "Official first-party free submission portal. Submit one MP3 at 320kbps minimum or WAV file, a short two-to-three-sentence note, genre tag, contact email and a mandatory rights confirmation. The official homepage also publishes contact@getknownradio.com as a direct-email submission route. The station says every submission gets at least a sixty-second human listen and normally receives a decision within about two weeks.",
    "feeRequired": false,
    "feeAmount": "The official submission page states there is no application fee, paid-placement tier, required social follow, playlist exchange or premium submission lane.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Electronic/hip-hop/R&B programme fit, one-track file format and quality, direct upload versus published email route, mandatory broadcast-rights confirmation, broad non-exclusive worldwide royalty-free promotional and broadcast licence, indemnity, sample clearance, Content ID, AI-origin disclosure, Google reCAPTCHA Enterprise, privacy/US processing, file retention/removal handling and the final upload or email require human and legal review."
  }
];

export const run507SeedPlatforms: PlatformInput[] = [
  ...run507NewSeedPlatforms,
  ...run508SeedPlatforms
];
