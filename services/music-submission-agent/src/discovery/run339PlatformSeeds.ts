import type { PlatformInput } from '../models/types.js';

export const run339SeedPlatforms: PlatformInput[] = [
  {
    name: 'WPRB 103.3 FM Official Music Submission Route',
    websiteUrl: 'https://wprb.com/',
    submissionUrl: 'mailto:music@wprb.com',
    sourceUrl: 'https://wprb.com/music-submissions/',
    sourceType: 'automation_run_339_public_research',
    country: 'United States / Princeton, New Jersey / independent college and community-supported radio',
    language: 'en',
    genres: [
      'freeform',
      'electronic',
      'experimental',
      'ambient',
      'reggae',
      'world-music',
      'hip-hop',
      'independent-radio',
      'college-radio',
      'airplay-submission',
      'manual-review'
    ],
    submissionMethod: 'official-public-music-email-and-prioritized-physical-mail',
    feeRequired: false,
    feeAmount: 'No submission fee, account, login, CAPTCHA or mandatory payment is stated for the official email or physical-mail routes.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'WPRB officially accepts new music by email at music@wprb.com and by physical mail, while explicitly prioritizing physical submissions. A human must choose the relevant MarcsMusic track and delivery method, verify rights, release status, broadcast suitability, metadata and any clean-version requirements, approve all personal data, files or media, reconfirm the current instructions and perform the submission manually. The postal route must not be automated.',
    notes: 'Verified on 2026-07-13 from WPRB official first-party pages. The Music Submissions page invites artists, labels and promoters to submit new music, lists CDs, CD-Rs, LPs and multiple vinyl sizes for postal delivery, and publishes music@wprb.com as the digital alternative while stating that physical submissions are prioritized. The mailbox is a syntactically valid first-party WPRB-domain business address explicitly bound to music submissions. Current activity is supported by the live now-playing display, current programming schedule, active playlist system and 2026 site footer. No email, package, track, attachment, link, metadata or personal data was sent, and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed.'
  },
  {
    name: 'WCBN-FM Official Physical Music Submission Route',
    websiteUrl: 'https://wcbn.org/',
    submissionUrl: 'https://wcbn.org/c/',
    sourceUrl: 'https://wcbn.org/c/',
    sourceType: 'automation_run_339_public_research',
    country: 'United States / Ann Arbor, Michigan / University of Michigan student freeform radio',
    language: 'en',
    genres: [
      'freeform',
      'electronic',
      'experimental',
      'techno',
      'reggae',
      'world-music',
      'hip-hop',
      'jazz',
      'independent-radio',
      'college-radio',
      'physical-only',
      'airplay-submission',
      'manual-review'
    ],
    submissionMethod: 'official-physical-hard-copy-only-music-department-route',
    feeRequired: false,
    feeAmount: 'No submission fee, account, login, CAPTCHA or mandatory payment is stated; the sender remains responsible for producing and mailing physical media.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'WCBN officially accepts music from musicians who send a hard copy of their album, preferably on CD or vinyl, to the station music department. A human must determine whether physical production and postage are justified, select the correct release and optional genre-director routing, verify rights, release status, metadata, clean-version needs and packaging, and arrange shipment manually. The Cloudflare-protected Music Directors email was not decoded or used as a submission route.',
    notes: 'Verified on 2026-07-13 from WCBN official first-party pages. The contact page publishes the WCBN-FM mailing address, states that music is accepted from any musicians willing to send a hard copy of an album, prefers CD or vinyl, says everything received is listened to and permits genre-specific packages to be addressed care of the relevant director. The page displays a Music Directors email through Cloudflare protection; it was deliberately not decoded, guessed or stored. WCBN presents itself as a student-run freeform station broadcasting 24/7, and the current contact page lists board and staff terms extending through 2026. No email, message, package, track, physical medium, metadata or personal data was sent, and no anti-bot or email-protection control was bypassed.'
  }
];
