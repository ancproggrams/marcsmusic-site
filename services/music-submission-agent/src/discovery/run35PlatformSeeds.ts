import type { PlatformInput } from '../models/types.js';

export const run35SeedPlatforms: PlatformInput[] = [
  {
    name: 'WMNF 88.5 FM Submit Your Music Form',
    websiteUrl: 'https://www.wmnf.org/',
    submissionUrl: 'https://www.wmnf.org/submit-music/',
    sourceUrl: 'https://www.wmnf.org/submit-music/',
    sourceType: 'automation_run_35_public_research',
    country: 'United States / Tampa Florida / community radio, FM broadcast and global streaming audience',
    language: 'en',
    genres: [
      'electronic',
      'indie',
      'hip-hop',
      'reggae',
      'dub',
      'world',
      'jazz',
      'local-music',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-public-upload-form-and-music-department-email-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official public form collects artist metadata, contact email, release metadata and audio upload/files; file selection, rights, clean/radio-safe status, focus tracks and owner-approved notes require manual review before any submission.',
    notes:
      'Official WMNF Submit your music page states all music emails should go to musicrelations@wmnf.org and exposes upload fields for audio files. WMNF current activity was verified through 2026 station/music posts. No form was submitted, no files were uploaded and no SMTP/MX probing was performed.'
  },
  {
    name: 'WWOZ Getting Airplay Music Director Route',
    websiteUrl: 'https://www.wwoz.org/',
    submissionUrl: 'https://www.wwoz.org/getting-airplay-your-cd-wwoz',
    sourceUrl: 'https://www.wwoz.org/getting-airplay-your-cd-wwoz',
    sourceType: 'automation_run_35_public_research',
    country: 'United States / New Orleans Louisiana / community radio, local culture and global online audience',
    language: 'en',
    genres: [
      'jazz',
      'blues',
      'funk',
      'soul',
      'reggae',
      'world',
      'roots',
      'new-orleans',
      'community-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-physical-cd-or-wav-airplay-route-through-music-director',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WWOZ prefers a physical finished CD package or WAV-format digital material, asks artists to target relevant shows, mark profanity/clean edits and mail/drop off copies; packaging, local fit, rights and clean-content review are manual-only.',
    notes:
      'Official WWOZ musician resource page documents the Getting Airplay route, Music Director mailing address and audio-format expectations. WWOZ current activity was verified through 2026 official site posts/events. No physical mail, drop-off, email or upload was attempted.'
  },
  {
    name: 'KDVS 90.3 FM Music Department Physical Submission Route',
    websiteUrl: 'https://kdvs.org/',
    submissionUrl: 'https://kdvs.org/contact',
    sourceUrl: 'https://kdvs.org/contact',
    sourceType: 'automation_run_35_public_research',
    country: 'United States / Davis California / freeform college-community radio and online stream',
    language: 'en',
    genres: [
      'freeform',
      'electronic',
      'hip-hop',
      'experimental',
      'indie',
      'punk',
      'jazz',
      'world',
      'college-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-music-director-contact-and-physical-submissions-only-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official KDVS contact page lists the Music Directors and states new music should be sent to the mailing address as physical submissions only; physical packaging, address use, rights and radio-safe metadata require manual handling.',
    notes:
      'Official KDVS contact page lists musicdept@kdvs.org for music review, library maintenance, mail sorting and record-label contact, with physical submissions only. No email, physical mail, upload or SMTP/MX probing was performed.'
  },
  {
    name: 'KAOS 89.3FM Olympia Submit Music Route',
    websiteUrl: 'https://www.kaosradio.org/',
    submissionUrl: 'https://www.kaosradio.org/submitmusic',
    sourceUrl: 'https://www.kaosradio.org/submitmusic',
    sourceType: 'automation_run_35_public_research',
    country: 'United States / Olympia Washington / hybrid college-community radio and online stream',
    language: 'en',
    genres: [
      'freeform',
      'independent',
      'electronic',
      'reggae',
      'dub',
      'hip-hop',
      'experimental',
      'world',
      'college-radio',
      'radio-airplay'
    ],
    submissionMethod: 'official-submit-music-page-with-physical-preference-and-digital-link-email',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KAOS prioritizes physical submissions, rejects singles, requires one-sheet/press release details and FCC violation/clean edit notes, and asks digital submissions to use links rather than attachments; fit and compliance checks require manual review.',
    notes:
      'Official KAOS Submit Music page provides Music Dept postal address and kaosmusicdirector@gmail.com for digital submissions with streaming/download links. 2026 activity was verified through official blog posts, charts and live-session posts. No email, form, file or physical submission was attempted.'
  },
  {
    name: 'KMNR 89.7 FM Music Director Route',
    websiteUrl: 'https://www.kmnr.org/',
    submissionUrl: 'https://www.kmnr.org/about/',
    sourceUrl: 'https://www.kmnr.org/about/',
    sourceType: 'automation_run_35_public_research',
    country: 'United States / Rolla Missouri / free-format college radio and webstream',
    language: 'en',
    genres: [
      'freeform',
      'college-radio',
      'electronic',
      'indie',
      'rock',
      'hip-hop',
      'experimental',
      'jazz',
      'local-music',
      'radio-airplay'
    ],
    submissionMethod: 'official-music-director-public-email-and-station-mailing-address-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The official site exposes a Music Director role/email and mailing address but no complete static submission form; outreach copy, media format, rights, clean-content status and station fit require owner-approved manual review.',
    notes:
      'Official KMNR site verifies current 2026 activity and lists Music Director music@kmnr.org plus station mailing details. No email, upload, physical mail, login, form submit or SMTP/MX probing was performed.'
  }
];
