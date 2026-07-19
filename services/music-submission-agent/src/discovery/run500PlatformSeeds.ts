import type { PlatformInput } from '../models/types.js';
import { run501SeedPlatforms } from './run501PlatformSeeds.js';

const run500NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "Reggae Vibe Media Global Reggae / Dancehall / Soca / Afrobeat Upload Form",
    "websiteUrl": "https://reggaevibe.org/",
    "submissionUrl": "https://reggaevibe.org/media-submission/",
    "sourceUrl": "https://reggaevibe.org/media-submission/",
    "sourceType": "automation_run_500_public_research",
    "country": "United States / Caribbean-focused media network with global digital radio, app and editorial reach.",
    "language": "en",
    "genres": [
      "reggae",
      "roots reggae",
      "dub",
      "dancehall",
      "soca",
      "Afrobeat",
      "Caribbean music",
      "African music",
      "radio airplay",
      "editorial coverage"
    ],
    "submissionMethod": "Official first-party music-upload form requesting artist name, song title and audio file, with published quality, clean-edit, metadata and optional EPK guidance.",
    "feeRequired": false,
    "feeAmount": "No mandatory submission or review fee is visible on the official media-submission page.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Genre and positive-content fit, clean radio edit, 320 kbps MP3 or WAV, metadata and credits, optional EPK assets, master/composition/sample/contributor rights, Content ID, AI-origin disclosure, the site's unusually broad generic submission-rights language, privacy/retention, visible honeypot handling and the final upload require human and legal review."
  },
  {
    "name": "Crags Radio Global Community Airplay Direct-Upload Form",
    "websiteUrl": "https://cragsradio.co.uk/",
    "submissionUrl": "https://cragsradio.co.uk/submit/",
    "sourceUrl": "https://cragsradio.co.uk/submit/",
    "sourceType": "automation_run_500_public_research",
    "country": "United Kingdom / community station serving North Nottinghamshire and North East Derbyshire while streaming to a global online audience.",
    "language": "en",
    "genres": [
      "unsigned music",
      "indie",
      "electronic",
      "dance",
      "house",
      "chillout",
      "pop",
      "rock",
      "reggae",
      "soul",
      "global music",
      "radio airplay"
    ],
    "submissionMethod": "Official first-party airplay form requesting artist or band name, track title, email, direct track upload, social links and background information.",
    "feeRequired": false,
    "feeAmount": "No mandatory submission, review or airplay fee is visible on the official form.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Programme and genre fit, upload format and size, clean/broadcast suitability, metadata, artist context and socials, master/composition/sample/contributor rights, Content ID, AI-origin disclosure, the site's incomplete/default privacy policy, hidden anti-spam controls, presenter review and the final upload require human review."
  },
  {
    "name": "Future SynthPop Radio Worldwide Electronic Jotform Submission",
    "websiteUrl": "https://www.synthpopradio.com/",
    "submissionUrl": "https://form.jotform.com/252044079959063",
    "sourceUrl": "https://synthpopradio.com/music-submission",
    "sourceType": "automation_run_500_public_research",
    "country": "United States / worldwide 24/7 online electronic radio station.",
    "language": "en",
    "genres": [
      "synthpop",
      "futurepop",
      "darkwave",
      "EBM",
      "industrial",
      "electronic pop",
      "synthwave",
      "electronic music",
      "radio airplay",
      "video feature"
    ],
    "submissionMethod": "Official first-party submission page linking to an external Jotform requesting name, email, a downloadable music/context link, optional video-feature permission and mandatory broadcast-rights terms acceptance.",
    "feeRequired": false,
    "feeAmount": "No mandatory submission or review fee is visible on the official page or linked form.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Electronic/synth catalogue fit, downloadable link access, supporting artist and social information, master/composition/sample/contributor and broadcast rights, optional YouTube video permission, mandatory form terms, Content ID, AI-origin disclosure, Jotform privacy/retention and hidden verification, plus the final submission require human review."
  }
];

export const run500SeedPlatforms: PlatformInput[] = [
  ...run500NewSeedPlatforms,
  ...run501SeedPlatforms
];
