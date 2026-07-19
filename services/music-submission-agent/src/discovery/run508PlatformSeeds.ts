import type { PlatformInput } from '../models/types.js';
import { run509SeedPlatforms } from './run509PlatformSeeds.js';

const run508NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "Intrigue Music Drum & Bass Demo Email",
    "websiteUrl": "https://www.intrigue.org.uk/",
    "submissionUrl": "mailto:demobox@intrigue.org.uk",
    "sourceUrl": "https://www.intrigue.org.uk/contact/",
    "sourceType": "automation_run_508_public_research",
    "country": "United Kingdom / Bristol-based Drum & Bass label and club night with international digital reach; the public demo route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "drum and bass",
      "liquid drum and bass",
      "deep drum and bass",
      "soulful drum and bass",
      "label demo",
      "DJ mix"
    ],
    "submissionMethod": "Official first-party demo mailbox. Email demobox@intrigue.org.uk to submit a label demo or a DJ set for the Intrigue club night. The official page asks DJ-mix submissions to include contact information and a tracklist. It publishes info@intrigue.org.uk for general contact, not as a substitute for the demo mailbox.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission, account or payment fee is published on the official contact page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Exact Drum & Bass catalogue or club-night fit, selection of label demo versus DJ mix, audio/link format, contact details and DJ-mix tracklist, release status, master/composition/sample/contributor rights, Content ID, AI-origin disclosure, email privacy/retention, possible post-selection agreement and the final email require human review."
  },
  {
    "name": "behind the sun Recordings Liquid DnB / Breakbeat Demo Form",
    "websiteUrl": "https://behindthesunrecordings.com/",
    "submissionUrl": "https://behindthesunrecordings.com/contact/",
    "sourceUrl": "https://behindthesunrecordings.com/contact/",
    "sourceType": "automation_run_508_public_research",
    "country": "South America / independent digital label focused on Liquid Drum & Bass, atmospheric Breaks and Breakbeat; the public demo route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "liquid drum and bass",
      "soulful drum and bass",
      "atmospheric breaks",
      "breakbeat",
      "original productions",
      "private SoundCloud",
      "Dropbox"
    ],
    "submissionMethod": "Official first-party contact form. Select Demo Submission as the subject and provide an original, finished production through a private SoundCloud or Dropbox link. The label accepts Liquid Drum & Bass, Atmospheric Breaks and Breakbeat and explicitly rejects works in progress, remixes, bootlegs and mash-ups. The form requires acknowledgement of the Privacy Policy.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission, account or payment fee is published on the official contact and demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Liquid-DnB/Breakbeat catalogue fit, original and finished status, exclusion of WIPs/remixes/bootlegs/mash-ups, private-link access, mandatory privacy-policy acknowledgement, rights and samples, Content ID, AI-origin disclosure, privacy/retention, cookie and hidden anti-spam or submit-time controls, possible post-selection contract and the final form require human review."
  },
  {
    "name": "Sub Wavelength Recordings Liquid / Deep DnB Demo Form",
    "websiteUrl": "https://sub-wavelength.com/sub-wavelength-recordings",
    "submissionUrl": "https://sub-wavelength.com/demo-submissions",
    "sourceUrl": "https://sub-wavelength.com/demo-submissions",
    "sourceType": "automation_run_508_public_research",
    "country": "United Kingdom / Birmingham-based Drum & Bass label with internationally available releases; the public demo route does not publish a geographic exclusion.",
    "language": "en",
    "genres": [
      "drum and bass",
      "liquid drum and bass",
      "deep drum and bass",
      "dark drum and bass",
      "downloadable music link"
    ],
    "submissionMethod": "Official first-party demo form. Provide artist name, legal/full name or names, email, downloadable music links and information about yourself. The label states that it is looking for new Liquid, Deep or Dark Drum & Bass. The official site separately publishes subwavelengthrecordings@gmail.com as the record-label contact, but the form remains the canonical demo route.",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission, account or payment fee is published on the official label or demo-submission pages. Separate mastering services are commercial but are not presented as a condition of label review.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Liquid/deep/dark Drum & Bass catalogue fit, downloadable-link access, artist and legal-name handling, biography/context quality, rights and samples, Content ID, AI-origin disclosure, privacy/retention, separation from adjacent paid mastering services, hidden anti-spam or submit-time controls, possible post-selection contract and the final form require human review."
  }
];

export const run508SeedPlatforms: PlatformInput[] = [
  ...run508NewSeedPlatforms,
  ...run509SeedPlatforms
];
