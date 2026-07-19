import type { PlatformInput } from '../models/types.js';
import { run506SeedPlatforms } from './run506PlatformSeeds.js';

const run505NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "SoundChat Radio Global Caribbean Music Submission Form",
    "websiteUrl": "https://soundchatradio.com/",
    "submissionUrl": "https://soundchatradio.com/submit-music",
    "sourceUrl": "https://soundchatradio.com/submit-music",
    "sourceType": "automation_run_505_public_research",
    "country": "United States / New York-based Caribbean radio and media platform explicitly promoting global reach to more than 100 countries.",
    "language": "en",
    "genres": [
      "reggae",
      "dancehall",
      "soca",
      "Caribbean music",
      "clean radio edit",
      "MP3 320kbps",
      "WAV",
      "stream or download link"
    ],
    "submissionMethod": "Official first-party music-submission form. Provide artist name, email, track title, genre, a SoundCloud/Spotify/YouTube/direct-download link and artist or track context. High-quality MP3 320kbps or WAV is preferred, clean radio edits should accompany explicit versions, metadata should be complete, and a short bio plus social links are requested.",
    "feeRequired": false,
    "feeAmount": "The official submission page states that standard music submission is completely free. A separate Stripe donation page is optional and is not part of the submission route.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Caribbean-programme and clean-radio fit, track-link accessibility, metadata, biography and social links, master/composition/sample/contributor rights, explicit-to-clean version handling, the mandatory ownership confirmation and broadcast permission, Content ID, AI-origin disclosure, privacy/retention, hidden anti-spam or submit-time controls and the final form require human review."
  },
  {
    "name": "Symmetry Recordings Drum & Bass Demo Email / DemoBox",
    "websiteUrl": "https://www.symmetryrecordings.co.uk/",
    "submissionUrl": "https://www.symmetryrecordings.co.uk/demos",
    "sourceUrl": "https://www.symmetryrecordings.co.uk/demos",
    "sourceType": "automation_run_505_public_research",
    "country": "United Kingdom / Bristol drum-and-bass label; the public route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "drum and bass",
      "jungle",
      "bass music",
      "320kbps MP3",
      "WAV",
      "download-enabled SoundCloud",
      "cloud storage link"
    ],
    "submissionMethod": "Official first-party demo page authorizes demos@symmetryrecordings.co.uk. Send producer and track names with 320kbps MP3 or WAV files attached to an email or linked from cloud storage. SoundCloud is accepted only when downloading is enabled. The official Bandcamp catalogue also links to a LabelWorx DemoBox, retained as an adjacent representation of the same opportunity rather than a separate queue item.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission or release fee is published on the official first-party demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Drum-and-bass catalogue fit, producer and track naming, choosing email attachment versus downloadable cloud/SoundCloud delivery, attachment security and size, master/composition/sample/contributor rights, unreleased or exclusivity status, Content ID, AI-origin disclosure, email privacy/retention, the adjacent LabelWorx form and its consent controls, post-selection contract and the final email or form require human review."
  },
  {
    "name": "Frequenza Records Exclusive Electronic Demo Contact Form",
    "websiteUrl": "https://www.frequenzarec.com/",
    "submissionUrl": "https://www.frequenzarec.com/contact/",
    "sourceUrl": "https://www.frequenzarec.com/contact/",
    "sourceType": "automation_run_505_public_research",
    "country": "Italy / internationally distributed electronic label; the public route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "techno",
      "melodic house and techno",
      "tech house",
      "electronic music",
      "exclusive demos",
      "private SoundCloud link",
      "minimum two tracks",
      "no AI-generated music"
    ],
    "submissionMethod": "Official first-party contact form with a DEMO selector. Submit an exclusive set of at least two fitting tracks using private SoundCloud or dedicated demo links. Dropbox, Google Drive and similar links are rejected, and the label explicitly rejects AI-generated music.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission or release fee is published on the official contact and demo page. Adjacent mixing, mastering, distribution and publishing services are separate enquiries and not submission requirements.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Techno/house catalogue fit, minimum-two-track exclusivity, private SoundCloud or demo-link format, rejection of Drive/Dropbox routes, hard AI-generated-music exclusion and provenance evidence, master/composition/sample/contributor rights, Content ID, privacy/retention, JavaScript and hidden anti-spam or submit-time verification, adjacent commercial-service selectors, post-selection contract and the final form require human review."
  }
];

export const run505SeedPlatforms: PlatformInput[] = [
  ...run505NewSeedPlatforms,
  ...run506SeedPlatforms
];
