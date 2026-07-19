import type { PlatformInput } from '../models/types.js';
import { run507SeedPlatforms } from './run507PlatformSeeds.js';

const run506NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "Bass Darkness Phonk & Heavy Bass Demo Form",
    "websiteUrl": "https://www.bassdarkness.com/",
    "submissionUrl": "https://www.bassdarkness.com/submissions",
    "sourceUrl": "https://www.bassdarkness.com/submissions",
    "sourceType": "automation_run_506_public_research",
    "country": "Germany / independent label with internationally distributed Phonk, Bass and dark electronic releases; the public route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "phonk",
      "bass music",
      "dark electronic",
      "heavy bass",
      "finished tracks",
      "private SoundCloud",
      "Dropbox"
    ],
    "submissionMethod": "Official first-party demo form. Submit artist name(s), email, track title, a private SoundCloud or Dropbox link, optional notes and Discord/Instagram contact details. Finished tracks are required. If the form confirmation does not arrive, the official page authorizes demo@bassdarkness.com as a fallback.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission or release fee is published on the official submission page. The label advertises distribution and marketing services, but those are not presented as conditions of demo review.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Phonk/heavy-bass catalogue fit, finished-track status, private-link access and downloads, Discord/Instagram contact fields, form-confirmation versus authorized fallback email, master/composition/sample/contributor rights, Content ID, AI-origin disclosure, privacy/retention, hidden anti-spam or submit-time controls, post-selection contract and the final form or email require human review."
  },
  {
    "name": "Boomslang Recordings Neurofunk Demo Google Form",
    "websiteUrl": "https://boomslangrecordings.com/",
    "submissionUrl": "https://forms.gle/cCHYTFYf6WTakspM7",
    "sourceUrl": "https://boomslangrecordings.com/submit-a-demo/",
    "sourceType": "automation_run_506_public_research",
    "country": "United States / Dallas-based drum-and-bass and neurofunk label with artists and listeners worldwide; the public route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "drum and bass",
      "neurofunk",
      "dark drum and bass",
      "technical bass music",
      "private SoundCloud",
      "streaming download link"
    ],
    "submissionMethod": "Official first-party demo page links to an external Google Form. Provide a streaming link with download access, such as a private SoundCloud link. Do not send attachments or direct download files and do not email demos to other addresses.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission or release fee is published on the official first-party demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Drum-and-bass/neurofunk catalogue fit, streaming-link and download-access requirements, external Google Form fields, session/login and CAPTCHA status, rights and samples, Content ID, AI-origin disclosure, privacy/retention, Google and label terms, hidden anti-spam controls, post-selection contract and the final form require human review."
  },
  {
    "name": "Indie Global 365 Caribbean & Positive Music Airplay Upload",
    "websiteUrl": "https://indieglobal365.com/",
    "submissionUrl": "https://indieglobal365.com/music-submission/",
    "sourceUrl": "https://indieglobal365.com/music-submission/",
    "sourceType": "automation_run_506_public_research",
    "country": "United States / internet-radio and independent-artist platform presented for global digital listening; no geographic exclusion is published.",
    "language": "en",
    "genres": [
      "reggae",
      "soca",
      "Caribbean music",
      "hip-hop",
      "R&B",
      "positive music",
      "uplifting music",
      "motivational music",
      "192kbps MP3",
      "direct upload"
    ],
    "submissionMethod": "Official first-party free airplay form. Submit artist name, email and song title, upload up to two MP3 songs plus one image per song, use artist-and-title file names and accept the linked Terms & Conditions. The page specifies 192kbps MP3 files and a 10MB limit per song, while the upload widget displays a 25MB overall limit.",
    "feeRequired": false,
    "feeAmount": "The airplay-submission route is explicitly free. A separate optional artist-membership plan is advertised at a one-time USD 15 fee and is not required for the free submission route.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Caribbean/positive-content and programme fit, conflicting Afro-Pop eligibility text, MP3 bitrate and upload-size limits, image requirements, mandatory Terms acceptance, conflicting current-form versus legacy email/CD instructions, ASCAP/BMI/SoundExchange or direct-rights representations, broadcast/streaming permission, rights and samples, Content ID, AI-origin disclosure, privacy/retention, optional membership, hidden anti-spam controls and the final upload require human and legal review."
  }
];

export const run506SeedPlatforms: PlatformInput[] = [
  ...run506NewSeedPlatforms,
  ...run507SeedPlatforms
];
