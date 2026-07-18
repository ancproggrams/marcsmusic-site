import type { PlatformInput } from '../models/types.js';

export const run470SeedPlatforms: PlatformInput[] = [
  {
    name: 'KWDC 93.5 FM Music Submission',
    websiteUrl: 'https://www.kwdc.fm/',
    submissionUrl: 'https://www.kwdc.fm/music-submissions',
    sourceUrl: 'https://www.kwdc.fm/music-submissions',
    sourceType: 'automation_run_470_public_research',
    country:
      'United States (Stockton, California); the first-party page accepts unsigned and local music but does not explicitly confirm international eligibility',
    language: 'en',
    genres: [
      'dance',
      'latin',
      'top-40',
      'rock',
      'indie',
      'unsigned',
      'college-radio',
      'clean-radio',
      'email-attachment',
      'consent-form',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-email-route-requiring-a-signed-music-consent-form-and-mp3-attachment',
    feeRequired: false,
    feeAmount: 'No submission fee or payment step is published on the first-party music-submission page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route requires a signed consent form, a direct MP3 email attachment, clean-content compliance and mastering checks. The linked consent PDF and Google consent form were not passively retrievable, international and AI-music eligibility are not explicit, and any hidden form controls, legal terms, rights declarations and final send action require human review.',
    notes:
      'Passively verified on 2026-07-18 from the first-party music-submission and Summer 2026 schedule pages. KWDC publishes kwdc@deltacollege.edu as the submission address, requires the subject Music Submission, submitter and artist details, a signed or digitally completed consent form, clean lyrics, MP3 files and a stereo master at -3 dB. The Summer 2026 schedule states that the station runs 24 hours daily and plays Latin, Top 40, Rock and Dance; the submission page says The Underground Hour highlights unsigned music daily. No form field was filled, no consent was signed, no file was attached, no email was sent, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  {
    name: 'Qfm 94.3 Tenerife Music Submissions',
    websiteUrl: 'https://www.qmusica.com/',
    submissionUrl: 'https://www.qmusica.com/music-submissions-qfm',
    sourceUrl: 'https://www.qmusica.com/music-submissions-qfm',
    sourceType: 'automation_run_470_public_research',
    country:
      'Spain (Tenerife, Canary Islands); the first-party page explicitly promotes regional, national and international artists',
    language: 'en',
    genres: [
      'jazz',
      'smooth-jazz',
      'cool-jazz',
      'acid-jazz',
      'nu-jazz',
      'soul',
      'funk',
      'blues',
      'world-fusion',
      'chillout',
      'electronic',
      'unsigned',
      'radio-airplay',
      'contact-form',
      'external-download-link',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-contact-form-carrying-a-wetransfer-or-dropbox-download-link',
    feeRequired: false,
    feeAmount: 'Qfm states that promotion of regional, national and international artists via airplay is totally free of charge.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route requires genre-specific track selection, MP3 and metadata preparation, a ZIP package, an external WeTransfer or Dropbox upload and a first-party contact-form submission. External-hosting privacy and permissions, unpublished AI eligibility, rights, hidden anti-spam controls and the final upload and submit actions require human approval.',
    notes:
      'Passively verified on 2026-07-18 from Qfm first-party home, programs, music-submission and contact pages. Qfm explicitly accepts international artists in Jazz, Smooth Jazz, Cool Jazz, Swing, Acid Jazz, Nu-Jazz, Soul, Funk, Blues and World Fusion. It requests 192 or 320 kbps constant-bitrate MP3 files sourced from masters, complete Artist + Title tags, trimmed silence, artist information or biography, a ZIP folder and a WeTransfer or Dropbox link pasted into the public contact form. YouTube, Facebook, Google Drive and SoundCloud links are rejected. The current site advertises FM, DAB+ and streaming plus Sunset Sessions, World Grooves, Chillout Zone and a monthly unsigned-artist show. No external file was uploaded, no form field was filled, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  }
];
