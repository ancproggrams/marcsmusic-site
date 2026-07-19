import type { PlatformInput } from '../models/types.js';
import { run493SeedPlatforms } from './run493PlatformSeeds.js';

const run492NewSeedPlatforms: PlatformInput[] = [
  {
    "name": "MelodicLab Records Progressive House & Melodic-Techno Demo",
    "websiteUrl": "https://www.melodiclabrecords.com/",
    "submissionUrl": "mailto:info@melodiclabrecords.com",
    "sourceUrl": "https://melodiclabrecords.com/DEMO-SUBMISSION/",
    "sourceType": "automation_run_492_public_research",
    "country": "Netherlands / Dutch-founded progressive-house and melodic-techno label; no geographic submission restriction is published.",
    "language": "en",
    "genres": [
      "progressive house",
      "melodic techno",
      "progressive melodic techno",
      "private SoundCloud",
      "download enabled",
      "email submission",
      "manual-review"
    ],
    "submissionMethod": "official first-party demo instruction page authorizing email submission to info@melodiclabrecords.com with an exclusive private downloadable SoundCloud link, a personal introduction and social-media links",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, release or submission fee is published on the official demo page.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Label and subgenre fit, exclusive private-link access and download permissions, artist introduction and social links, unreleased status, rights and samples, AI policy, privacy/retention, post-selection contract terms and the final email require human review.",
    "notes": "Passively verified on 2026-07-19 from MelodicLab Records' official demo, home and contact pages. The demo page authorizes info@melodiclabrecords.com and requires an exclusive private downloadable SoundCloud link, a personal message and all social-media links. It instructs artists to check prior releases and podcasts for fit, says mass emails are deleted and states an intended response window of up to 14 days. The mailbox is first-party published, syntactically valid, domain-aligned and explicitly used for demos. The general contact form was not treated as a second submission route. Activity is current: the official home page identifies MLR036, Sagou & Du More - Biophonic, with a release date of June 19, 2026. No email, private link, social profile or submission was used."
  },
  {
    "name": "Another Life Music Emotional Progressive-House Demo",
    "websiteUrl": "https://www.anotherlifemusic.ch/",
    "submissionUrl": "mailto:demo@anotherlifemusic.ch",
    "sourceUrl": "https://soundcloud.com/anotherlifemusic_ch",
    "sourceType": "automation_run_492_public_research",
    "country": "Switzerland / Rüti-based digital electronic label; no geographic submission restriction is published.",
    "language": "en",
    "genres": [
      "progressive house",
      "emotional progressive house",
      "melancholic progressive house",
      "private SoundCloud",
      "email submission",
      "social media links",
      "manual-review"
    ],
    "submissionMethod": "official label profile authorizing demo@anotherlifemusic.ch for an exclusive private SoundCloud link, a personal introduction and social-media links after checking catalog fit",
    "feeRequired": false,
    "feeAmount": "No mandatory demo-review, release or submission fee is published in the official demo instructions.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Emotional-progressive label fit, exclusive private-link access, artist introduction and socials, release status, rights and samples, AI policy, privacy/retention, post-selection agreement terms and the final email require human review.",
    "notes": "Passively verified on 2026-07-19 from Another Life Music's official SoundCloud label profile, which links the label website and publishes demo@anotherlifemusic.ch and info@anotherlifemusic.ch. The profile describes a Swiss digital electronic label specializing in emotional and melancholic progressive house and requires demos exclusively as private SoundCloud links with a personal introduction and social-media links. It advises checking previous releases, says mass emails are deleted and gives a normal response expectation of 7 to 14 days. Both addresses are syntactically valid, first-party published and domain-aligned; only demo@ is canonical for submissions. Activity is current: the official profile shows releases dated March 28 and March 30, 2026 and label mixes published April 29, 2026. No email, private link or submission was used."
  },
  {
    "name": "Plazma Records Minimal & Techno Paid-Release Demo",
    "websiteUrl": "https://plazmarec.com/",
    "submissionUrl": "https://plazmarec.com/demo-submission",
    "sourceUrl": "https://plazmarec.com/demo-submission",
    "sourceType": "automation_run_492_public_research",
    "country": "Switzerland / Germany; the official contact page lists Zürich and Bremen. Universal international eligibility is not expressly guaranteed.",
    "language": "en",
    "genres": [
      "minimal",
      "techno",
      "electronica",
      "hypnotic techno",
      "private SoundCloud",
      "paid release plan",
      "captcha",
      "honeypot",
      "manual-review"
    ],
    "submissionMethod": "official first-party private-SoundCloud demo form with artist, profile and fit fields, privacy confirmation, visible CAPTCHA and honeypot; selected artists must choose and pay for a one-time release plan",
    "feeRequired": true,
    "feeAmount": "Initial demo review is presented before payment, but invited artists must select a one-time plan currently listed at €199, €299 or €699 including VAT to proceed with the release collaboration.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": true,
    "manualReviewRequired": true,
    "manualReviewReason": "Visible CAPTCHA and honeypot, private-link and metadata checks, full-finished-track and genre fit, privacy consent, rights and samples, AI policy, mandatory post-invitation pricing and payment, service-versus-label-contract terms and the final form require human review.",
    "notes": "Passively verified on 2026-07-19 from Plazma Records' official demo, contact, privacy and release pages. The form requires a 320kbps full-length finished track in a private SoundCloud link, proper Artist - Title naming, artist and email details, biography/fit explanations, optional profile links and privacy confirmation. A visible CAPTCHA and a 'If you are human, leave this field blank' honeypot are present and were not touched. The published process says matching demos receive an invitation and must then select a one-time Essential (€199), Spotlight (€299) or Residential (€699) plan. info@plazmarec.com and demo@plazmarec.com are first-party published, syntactically valid and domain-aligned, but the form was retained as canonical. Activity is current: the official release page dates Michael Morra's ZERØ EP (PLZM092) to May 8, 2026, and the official label profile shows tracks published March 24, 2026. No form field, CAPTCHA, honeypot, private link, payment or submission was used."
  }
];

export const run492SeedPlatforms: PlatformInput[] = [
  ...run492NewSeedPlatforms,
  ...run493SeedPlatforms
];
