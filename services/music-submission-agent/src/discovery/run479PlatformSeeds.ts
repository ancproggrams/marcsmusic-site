import type { PlatformInput } from '../models/types.js';
import { run480SeedPlatforms } from './run480PlatformSeeds.js';

const run479NewSeedPlatforms: PlatformInput[] = [
  {
    name: 'FBi Radio General Music Servicing',
    websiteUrl: 'https://www.fbi.radio/',
    submissionUrl: 'mailto:music@fbiradio.com',
    sourceUrl: 'https://www.fbi.radio/pages/music-submissions',
    sourceType: 'automation_run_479_public_research',
    country:
      'Australia / Sydney community radio with online worldwide streaming; the public submission page does not expressly guarantee eligibility for every international artist.',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'club',
      'bass',
      'ambient',
      'experimental',
      'world',
      'African',
      'Middle Eastern',
      'Asian',
      'soul',
      'funk',
      'independent',
      'new music',
      'email',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public music-director mailbox for digital general servicing with a stream link and free high-quality download link',
    feeRequired: false,
    feeAmount:
      'No mandatory fee is published for general editorial servicing; separate paid on-air promotional campaigns are optional and excluded.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'International eligibility and local-content preference, programme fit, release timing, 320 kbps MP3/WAV quality, metadata, stream/download permissions, music and press-image rights, AI eligibility, paid-route separation and the final email require human approval.',
    notes:
      'Passively verified on 2026-07-18 from the official submission page, schedule and recent programme archives. music@fbiradio.com is first-party published, syntactically valid and explicitly designated for general music servicing. It uses the station\'s legacy fbiradio.com business domain while the current website is fbi.radio. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email was drafted or sent, no link or image was shared, no login was used and no payment or submission action was performed.'
  },
  {
    name: 'WNAA 90.1 FM HD Music Submission',
    websiteUrl: 'https://wnaafmhd.com/',
    submissionUrl: 'mailto:wnaafm@ncat.edu',
    sourceUrl: 'https://wnaafmhd.com/music-submission/',
    sourceType: 'automation_run_479_public_research',
    country:
      'United States / North Carolina university FM and online station; the public music policy does not expressly confirm acceptance of every international artist.',
    language: 'en',
    genres: [
      'R&B',
      'smooth jazz',
      'blues',
      'hip-hop',
      'dance',
      'house',
      'Afrobeats',
      'reggae',
      'Go-Go',
      'gospel',
      'soul',
      'WAV',
      'MP3',
      'email',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public university-station mailbox for one original clean radio-ready WAV or MP3 plus a digital press kit',
    feeRequired: false,
    feeAmount:
      'No submission fee or mandatory payment is published for the official email route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'One-track selection, clean-content compliance, WAV/MP3 quality, filename and metadata, press-kit and media rights, attachment size, composition/master/sample/contributor rights, international and AI eligibility, required subject line and final email require human approval.',
    notes:
      'Passively verified on 2026-07-18 from WNAA\'s official 2026 submission, programming, live-listening, about and community-calendar pages. wnaafm@ncat.edu is first-party published, syntactically valid, hosted on the parent North Carolina A&T State University domain and explicitly designated for music submissions. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email was drafted or sent, no file or press kit was attached, no login was used and no payment or submission action was performed.'
  },
  {
    name: 'Kennesaw State Owl Radio Music Submission',
    websiteUrl: 'https://ksuradio.com/',
    submissionUrl: 'https://owllife.kennesaw.edu/submitter/form/step/1?Guid=985dbf34-2c5d-4ef7-a2ff-da89e923b538',
    sourceUrl: 'https://owllife.kennesaw.edu/submitter/form/step/1?Guid=985dbf34-2c5d-4ef7-a2ff-da89e923b538',
    sourceType: 'automation_run_479_public_research',
    country:
      'United States / Kennesaw State University student-run worldwide streaming station; the form states that submissions are accepted from anyone with recordings.',
    language: 'en',
    genres: [
      'independent',
      'underground',
      'electronic',
      'experimental',
      'world',
      'hip-hop',
      'rap',
      'pop',
      'jazz',
      'metal',
      'folk',
      'college radio',
      'direct-upload',
      'manual-review'
    ],
    submissionMethod:
      'official university-hosted public multi-step form accepting an MP3/WAV file and/or music link for editorial airplay consideration',
    feeRequired: false,
    feeAmount:
      'No mandatory submission fee or payment is visible on the public first step; later-step conditions remain a manual-review boundary.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The multi-step Owl Life form, possible later authentication/CAPTCHA/session controls, direct file upload, audio/link quality, rights, privacy and retention terms, international and AI eligibility, the non-returnable physical-media alternative and every final field or consent require human review.',
    notes:
      'Passively verified on 2026-07-18 from the official KSU-hosted submission form, Owl Radio homepage, current weekly schedule, team page and Kennesaw State Student Media pages. The form states that anyone with recordings may submit. owlradioksu@gmail.com is first-party published for follow-up but uses a consumer domain; programmingowlradio@kennesaw.edu is a current official programme contact, not a substitute submission route. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No form field was filled, no file or link was uploaded, no physical media was mailed, no login was attempted, no CAPTCHA or anti-spam control was bypassed and no payment or submission action was performed.'
  }
];

export const run479SeedPlatforms: PlatformInput[] = [
  ...run479NewSeedPlatforms,
  ...run480SeedPlatforms
];
