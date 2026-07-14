import type { PlatformInput } from '../models/types.js';

export const run363SeedPlatforms: PlatformInput[] = [
  {
    name: 'PBS 106.7FM International Digital Submission Form and Physical Music Route',
    websiteUrl: 'https://www.pbsfm.org.au/',
    submissionUrl: 'https://www.pbsfm.org.au/submitmusic',
    sourceUrl: 'https://www.pbsfm.org.au/submitmusic',
    sourceType: 'automation_run_363_public_research',
    country: 'Australia / Melbourne, Victoria / independent community radio',
    language: 'en',
    genres: [
      'independent',
      'under-represented-music',
      'electronic',
      'dance',
      'ambient',
      'experimental',
      'dub',
      'reggae',
      'global',
      'world-music',
      'hip-hop',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'international-submission',
      'submission-form',
      'captcha',
      'manual-review'
    ],
    submissionMethod: 'official-pbs-first-party-international-form-with-captcha-honeypot-or-physical-media',
    feeRequired: false,
    feeAmount:
      'No digital submission fee or mandatory payment is stated. Optional physical media production, international postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'PBS explicitly accepts music from local and international acts and prefers its first-party digital form. The form requests personal contact details, country and location, artist identity, biography, social and gig links, a stream link that must not be Spotify- or Deezer-only, and a free high-quality 320-kbps AAC/MP3 or WAV-equivalent download link. It also exposes an optional newsletter consent, a leave-blank anti-spam field and an explicit CAPTCHA. A human must review privacy, consent, rights, data minimization, asset access, release fit and the live CAPTCHA before submission. Do not automate the form, populate the honeypot or bypass human verification. PBS also authorizes CDs or vinyl by post or in person, recommends four to five copies and asks for a one-page press release or biography with each CD; physical preparation, postage and customs require manual handling.',
    notes:
      'Verified on 2026-07-14 from PBS official Submit Your Music, homepage and Program List pages. The form explicitly welcomes international acts and provides a country selector including the Netherlands. Current activity was confirmed through a feature release for July 13-19, 2026, July 2026 station news, upcoming July-August events and an active program list. Relevant programs cover electronic music, bass and beats, house, dub, reggae and dancehall, experimental ambience, global music, world music and hip-hop. No email address was inferred, no form field or CAPTCHA was completed and no file, link, package, consent or payment was submitted.'
  },
  {
    name: 'fbi.radio Digital Music Director Email Submission Route',
    websiteUrl: 'https://www.fbi.radio/',
    submissionUrl: 'https://www.fbi.radio/pages/music-submissions',
    sourceUrl: 'https://www.fbi.radio/pages/music-submissions',
    sourceType: 'automation_run_363_public_research',
    country: 'Australia / Sydney, New South Wales / independent youth community radio',
    language: 'en',
    genres: [
      'independent',
      'emerging-music',
      'electronic',
      'dance',
      'ambient',
      'experimental',
      'dub',
      'reggae',
      'dubstep',
      'drum-and-bass',
      'grime',
      'house',
      'techno',
      'global',
      'hip-hop',
      'community-radio',
      'radio-airplay',
      'email-submission',
      'digital-submission',
      'manual-review'
    ],
    submissionMethod: 'official-fbi-radio-music-director-email-with-stream-and-free-high-quality-download-links',
    feeRequired: false,
    feeAmount:
      'No editorial music-submission fee or mandatory payment is stated. Separate optional paid promotional campaigns are not part of the queued editorial route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'fbi.radio authorizes digital submissions to music@fbiradio.com. The email should have a clear artist-and-release subject, a short biography, press image or upcoming-gig details, a stream link and a free high-quality 320-kbps MP3 or WAV download link; expiring WeTransfer links should not be used. General playlist submissions should arrive before midnight Tuesday for Wednesday auditioning, and CDs are no longer accepted. A human must select an appropriate MarcsMusic release, verify download permissions, metadata, rights, release timing and geographic eligibility, and send the email manually. The station strongly identifies with emerging Sydney music and does not explicitly state an international eligibility rule on the reviewed submission page. Specialist-presenter, interview, gig-guide and paid-promotion contacts must remain separate and must not be used as duplicate submission routes.',
    notes:
      'Verified on 2026-07-14 from fbi.radio official Music Submissions, Contact, homepage and Genres pages. The purpose-bound mailbox music@fbiradio.com is published on both the official Contact and Music Submissions pages. Verification was limited to first-party publication, valid syntax, repeated stated Music Submissions purpose and alignment with the station-owned fbiradio.com contact domain; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. Current activity was confirmed through episodes and articles dated July 2026, including content dated 2026-07-14. The official genre index includes electronic, ambient, experimental, dub, reggae, dubstep, drum and bass, grime, house, techno, EDM, global and hip-hop-adjacent styles. No email, file, stream, download link, personal information, login, CAPTCHA or payment was sent.'
  }
];
