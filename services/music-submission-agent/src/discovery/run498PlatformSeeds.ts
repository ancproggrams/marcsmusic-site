import type { PlatformInput } from '../models/types.js';
import { run499SeedPlatforms } from './run499PlatformSeeds.js';

const run498NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "Monstercat Uncaged / Instinct / Silk LabelRadar Demo Portals",
    "websiteUrl": "https://www.monstercat.com/",
    "submissionUrl": "https://www.monstercat.com/contact-us",
    "sourceUrl": "https://www.monstercat.com/contact-us",
    "sourceType": "automation_run_498_public_research",
    "country": "Canada / United States / internationally active electronic label with artists and audiences worldwide; the public demo pages do not publish a country restriction.",
    "language": "en",
    "genres": [
      "dubstep",
      "drum and bass",
      "trap",
      "breaks",
      "bass music",
      "house",
      "pop",
      "indie dance",
      "progressive house",
      "deep house",
      "trance",
      "ambient",
      "chillout",
      "LabelRadar portal",
      "login/account boundary",
      "credit boundary",
      "manual-review"
    ],
    "submissionMethod": "official Monstercat contact and brand pages linking to external LabelRadar portals for the Uncaged, Instinct and Silk imprints",
    "feeRequired": false,
    "feeAmount": "No mandatory cash payment is required when a free LabelRadar Lite account has five available credits; each label submission consumes five credits, while additional credits and PRO are optional paid products.",
    "loginRequired": true,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "LabelRadar registration/login, available-credit balance, imprint and genre fit, track upload and 20-second preview selection, unreleased status, master/composition/sample/contributor rights, Content ID, generative-AI policy, optional fan-app exposure, privacy, hidden verification, post-selection terms and the final submission action require human review."
  },
  {
    "name": "NCS Electronic Music LabelRadar Demo Portal",
    "websiteUrl": "https://ncs.io/",
    "submissionUrl": "https://www.labelradar.com/labels/ncs/portal",
    "sourceUrl": "https://ncs.io/contact",
    "sourceType": "automation_run_498_public_research",
    "country": "United Kingdom / globally distributed electronic label and creator-music platform; the official contact route publishes no country restriction.",
    "language": "en",
    "genres": [
      "electronic music",
      "dubstep",
      "melodic dubstep",
      "drum and bass",
      "drumstep",
      "house",
      "future house",
      "progressive house",
      "bass music",
      "trap",
      "garage",
      "UKG",
      "techno",
      "trance",
      "LabelRadar portal",
      "login/account boundary",
      "credit boundary",
      "manual-review"
    ],
    "submissionMethod": "official NCS contact page linking to the external NCS LabelRadar demo portal",
    "feeRequired": false,
    "feeAmount": "No mandatory cash payment is required when a free LabelRadar Lite account has five available credits; one direct label submission consumes five credits, with optional paid credits and PRO.",
    "loginRequired": true,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "LabelRadar account access, available credits, exact NCS catalogue fit, upload and 20-second preview, release status, master/composition/sample/contributor rights, NCS creator-licensing implications, Content ID, generative-AI policy, optional fan-app exposure, privacy, hidden verification, post-selection terms and the final send action require human review."
  },
  {
    "name": "Steyoyoke Exclusive Ethereal-Techno Private-Playlist Demo Form",
    "websiteUrl": "https://www.steyoyoke.com/",
    "submissionUrl": "https://www.steyoyoke.com/submit-your-demo/",
    "sourceUrl": "https://www.steyoyoke.com/submit-your-demo/",
    "sourceType": "automation_run_498_public_research",
    "country": "Germany / Berlin-based independent electronic label; the form includes a country selector and publishes no territorial restriction.",
    "language": "en",
    "genres": [
      "ethereal techno",
      "melodic house and techno",
      "progressive house",
      "deep house",
      "ambient",
      "electronica",
      "exclusive private SoundCloud playlist",
      "first-party form",
      "rights confirmation",
      "manual-review"
    ],
    "submissionMethod": "official first-party demo form requiring an exclusive private SoundCloud playlist, artist/contact/profile fields, rights and data-processing confirmations, with an optional newsletter opt-in",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or release fee is visible on the official demo form.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "The route requires exclusivity and confirmation that no other labels or DJs are reviewing or testing the music. Catalogue fit, private-playlist access, exclusivity window, rights, Content ID, AI eligibility, personal-data consent, optional marketing consent, Cloudflare/browser verification, post-selection terms and the final form action require human review."
  }
];

export const run498SeedPlatforms: PlatformInput[] = [
  ...run498NewSeedPlatforms,
  ...run499SeedPlatforms
];
