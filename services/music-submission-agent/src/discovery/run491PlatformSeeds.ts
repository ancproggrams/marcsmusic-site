import type { PlatformInput } from '../models/types.js';
import { run492SeedPlatforms } from './run492PlatformSeeds.js';

const run491NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "Boomslang Recordings Global Neurofunk & Drum-and-Bass Demo",
    "websiteUrl": "https://boomslangrecordings.com/",
    "submissionUrl": "https://forms.gle/cCHYTFYf6WTakspM7",
    "sourceUrl": "https://boomslangrecordings.com/submit-a-demo/",
    "sourceType": "automation_run_491_public_research",
    "country": "United States / Dallas-based drum-and-bass label; the official site says its roster and search for artists are global.",
    "language": "en",
    "genres": [
      "drum and bass",
      "neurofunk",
      "dark drum and bass",
      "technical bass music",
      "global artists",
      "private SoundCloud",
      "Google Form",
      "manual-review"
    ],
    "submissionMethod": "official first-party demo page linking to an external Google Form; submit a streaming and downloadable private-demo link such as private SoundCloud, with no attachments or direct download files and no alternate email route",
    "feeRequired": false,
    "feeAmount": "No mandatory submission fee or paid review requirement is published on the canonical demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "External Google Form access, possible login or CAPTCHA, private-link permissions, downloadable-stream behavior, genre and release fit, rights, AI policy, privacy/storage, contract terms and the final submission require human review.",
    "notes": "Passively verified on 2026-07-19 from Boomslang Recordings' official home and demo pages, official SoundCloud and Beatport catalog. The label focuses on neurofunk and dark, technical drum and bass and describes artists from around the globe. The canonical page requires a streaming/downloadable demo link such as private SoundCloud, rejects attachments and download files, and says submissions sent to other email addresses will be ignored. The linked Google Form could not be passively loaded, so its exact fields, authentication, CAPTCHA, consent and storage controls remain unresolved. info@boomslangrecordings.com is first-party published, syntactically valid and domain-aligned, but is a general business contact and was not substituted for the form. Activity is supported by official SoundCloud tracks published on March 6, 2026 and Beatport releases dated January 30 and March 6, 2026. No form, link, email, login or submission was used."
  },
  {
    "name": "Bass Darkness Phonk & Heavy-Bass Demo Submission",
    "websiteUrl": "https://www.bassdarkness.com/",
    "submissionUrl": "https://www.bassdarkness.com/submissions",
    "sourceUrl": "https://www.bassdarkness.com/submissions",
    "sourceType": "automation_run_491_public_research",
    "country": "International independent bass label; the official site presents global distribution and artists with multi-country reach, while universal submitter eligibility is not separately guaranteed.",
    "language": "en",
    "genres": [
      "phonk",
      "bass music",
      "dark bass",
      "heavy-driven electronic",
      "finished tracks",
      "private SoundCloud",
      "Dropbox",
      "manual-review"
    ],
    "submissionMethod": "official first-party demo form for a finished track using a private SoundCloud or Dropbox link, artist and track details, notes and social contact data; demo@bassdarkness.com is the official fallback when no confirmation arrives",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review fee, release fee or payment requirement is published on the canonical submission page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Finished-track and label fit, private-link access, required social contact data, rights and samples, AI policy, privacy/retention, hidden form controls, post-selection contract terms and the final form or fallback email require human review.",
    "notes": "Passively verified on 2026-07-19 from Bass Darkness' official submission and home pages. The label requests finished tracks only, prefers private SoundCloud or Dropbox, focuses on Phonk, Bass and dark heavy-driven sounds, and publishes fields for artist name, email, track title, demo link, notes, Discord and Instagram. The page says most demos are reviewed in a few days and provides demo@bassdarkness.com only if the form confirmation is not received. The mailbox is first-party published, syntactically valid, domain-aligned and explicitly demo-related. The site states artists keep ownership and that release agreements are intended to be transparent, but exact contract, royalty, licence and termination terms are not published at submission time. Activity is strong: official releases are listed through July 3, 2026 and an upcoming release is dated July 24, 2026. No form field, social account, link, email or submission was used."
  },
  {
    "name": "BASSWAV Dutch Drum-and-Bass, Dubstep & UK-Bass Demo",
    "websiteUrl": "https://www.basswav.com/",
    "submissionUrl": "https://www.basswav.com/submit",
    "sourceUrl": "https://www.basswav.com/submit",
    "sourceType": "automation_run_491_public_research",
    "country": "Netherlands / independent bass label with Dutch and German roster artists; no country restriction is published, but universal international eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "drum and bass",
      "hard techno",
      "hard bass",
      "dubstep",
      "UK bass",
      "dancefloor bass",
      "private link",
      "two-step form",
      "manual-review"
    ],
    "submissionMethod": "official first-party two-step demo form using email and one private SoundCloud, Drive, Dropbox or WeTransfer link plus a short fit note; a visible honeypot field must remain untouched",
    "feeRequired": false,
    "feeAmount": "The label explicitly states zero upfront cost and no artist release charge.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Two-step form completion, visible honeypot, private-link access, track and genre fit, released-versus-unreleased status, rights and samples, AI policy, privacy/terms, later-step fields and the final submission require human review.",
    "notes": "Passively verified on 2026-07-19 from BASSWAV's official home, demo and release pages. The label signs drum and bass, hard techno, hard bass, dubstep and UK bass. Its form states one private link is the submission; step one exposes email and private-track-link fields, while the FAQ requests a short fit note and accepts private SoundCloud, Drive, Dropbox or WeTransfer links. The page allows an unfinished track when the direction is clear, discourages sending a public release already out everywhere, and states artists keep masters and options with no exclusivity or upfront cost. A visible 'Leave this field empty' honeypot was identified and not touched. The second step, full privacy wording and full terms were not passively available. Activity is current: the form metrics were verified May 23, 2026 and the label's BW002 release was issued June 5, 2026. No field, honeypot, private link or submission was used."
  }
];

export const run491SeedPlatforms: PlatformInput[] = [
  ...run491NewSeedPlatforms,
  ...run492SeedPlatforms
];
