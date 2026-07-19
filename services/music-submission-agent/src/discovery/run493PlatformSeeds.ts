import type { PlatformInput } from '../models/types.js';
import { run494SeedPlatforms } from './run494PlatformSeeds.js';

const run493NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "OVERCLOCKIN Records Bass-Music Demo Form",
    "websiteUrl": "https://www.overclockin.uk/",
    "submissionUrl": "https://www.overclockin.uk/demos",
    "sourceUrl": "https://www.overclockin.uk/demos",
    "sourceType": "automation_run_493_public_research",
    "country": "United Kingdom / London-registered bass-music label and creative agency; universal international demo eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "bass music",
      "drum and bass",
      "neurofunk",
      "dancefloor drum and bass",
      "liquid drum and bass",
      "private streamable link",
      "downloadable link",
      "first-party form",
      "manual-review"
    ],
    "submissionMethod": "official first-party demo form requesting stage name, email, social links and one streamable and downloadable private demo link",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, submission or release fee is visible on the official demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Bass-label fit, private-link access and download permission, release status, rights and samples, Content ID, AI policy, privacy and retention, any hidden form controls, post-selection contract terms and the final form action require human review.",
    "notes": "Passively verified on 2026-07-19 from OVERCLOCKIN's official demo, contact, music and release pages. The first-party form visibly requests stage name, email, social links and a streamable and downloadable private demo link. No mandatory login, payment or visible CAPTCHA was observed, but submit-time anti-spam and consent controls were not exercised. contact@overclockin.uk is first-party published, syntactically valid and domain-aligned, but is a general label mailbox rather than the canonical demo route. Activity is current: the official catalogue dates 20Sheet's Drum & Bass single Nympho to January 16, 2026, and the site identifies the company as OVERCLOCKIN Ltd. No field, private link, login, payment or submission was used."
  },
  {
    "name": "Magnetic Magazine Electronic Editorial & Demo Submission",
    "websiteUrl": "https://magneticmag.com/",
    "submissionUrl": "https://magneticmag.com/submit-your-music-to-magnetic-magazine/",
    "sourceUrl": "https://magneticmag.com/submit-your-music-to-magnetic-magazine/",
    "sourceType": "automation_run_493_public_research",
    "country": "United States / Denver-based electronic-music publication and record-label operation; universal international eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "electronic music",
      "house",
      "techno",
      "electronica",
      "ambient",
      "bass music",
      "editorial coverage",
      "premieres",
      "label demo review",
      "manual-review"
    ],
    "submissionMethod": "official first-party music-submission form for editorial coverage, premieres or demo review, requesting a private stream, release date, biography, artwork, press photos and project context",
    "feeRequired": false,
    "feeAmount": "No mandatory price is disclosed on the submission page; combined editorial and promotional packages are mentioned and may create an optional commercial-services boundary that must be reviewed before proceeding.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "The embedded form fields and submit-time controls require inspection, and editorial-versus-promotional service selection, private assets, rights, AI policy, privacy, publication permissions, any pricing, and the final form action require human approval.",
    "notes": "Passively verified on 2026-07-19 from Magnetic Magazine's official submission, contact, about, privacy and current homepage pages. The submission page accepts tracks, EPs, albums, DJ mixes, label releases and creative projects for reviews, interviews, SoundCloud premieres, social coverage and label consideration. It requests a private streaming link, release date, artist biography, artwork, press photos and contextual information, with optional download links and approved video assets. The embedded form's complete fields, CAPTCHA status, consent language and any package pricing were not passively exposed. reviews@magneticmag.com and demo@magneticmag.com are first-party published, syntactically valid and domain-aligned music/editorial contacts; the new dedicated form remains canonical. Activity is current: the official homepage lists multiple articles dated July 17, 2026. No form field, email, asset, payment or submission was used."
  },
  {
    "name": "Frequency State Electronic Curation via SubmitHub",
    "websiteUrl": "https://electronica.org.uk/",
    "submissionUrl": "https://www.submithub.com/to/frequency-state",
    "sourceUrl": "https://electronica.org.uk/submissions/",
    "sourceType": "automation_run_493_public_research",
    "country": "United Kingdom / independently run electronic-music platform; universal international eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "electronica",
      "ambient",
      "downtempo",
      "trip-hop",
      "experimental electronic",
      "bass music",
      "dubstep",
      "halftime",
      "drum and bass",
      "SubmitHub",
      "manual-review"
    ],
    "submissionMethod": "official Frequency State page directing artists to its verified SubmitHub curator profile for playlist, review, Mixcloud-programme or mailing-list consideration",
    "feeRequired": false,
    "feeAmount": "SubmitHub supports standard free credits and optional premium paid credits; the exact Frequency State campaign options must be checked inside the authenticated account.",
    "loginRequired": true,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "SubmitHub registration and session use, current standard-versus-premium credit availability, curator fit, platform terms, rights, AI and privacy settings, possible human verification and the final campaign action require human review.",
    "notes": "Passively verified on 2026-07-19 from Frequency State's official submission and about pages, its linked SubmitHub profile, current review archive and SubmitHub's official terms. Frequency State seeks independent electronica, ambient, downtempo, experimental, bass music and drum-and-bass releases and may use selected music in Spotify playlists, reviews, Mixcloud programmes or mailing-list features. Its official page says SubmitHub is the preferred route and every submission is listened to, with responses where possible. SubmitHub requires registration and offers both standard free and premium paid credits; account, credit, current curator availability and platform-control details were not exercised. Activity is current: the official review archive shows posts dated July 5 and July 6, 2026. No account, credit, music link, payment or submission was used."
  }
];

export const run493SeedPlatforms: PlatformInput[] = [
  ...run493NewSeedPlatforms,
  ...run494SeedPlatforms
];
