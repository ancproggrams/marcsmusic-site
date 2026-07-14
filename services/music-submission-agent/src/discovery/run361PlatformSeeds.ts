import type { PlatformInput } from '../models/types.js';

export const run361SeedPlatforms: PlatformInput[] = [
  {
    name: 'WPRB 103.3 FM Digital-or-Physical New Music Submission Route',
    websiteUrl: 'https://wprb.com/',
    submissionUrl: 'https://wprb.com/music-submissions/',
    sourceUrl: 'https://wprb.com/music-submissions/',
    sourceType: 'automation_run_361_public_research',
    country: 'United States / Princeton, New Jersey / community-supported independent freeform radio',
    language: 'en',
    genres: [
      'freeform',
      'independent',
      'electronic',
      'experimental',
      'ambient',
      'dub',
      'reggae',
      'world-music',
      'hip-hop',
      'college-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'manual-review'
    ],
    submissionMethod: 'official-wprb-music-director-email-or-prioritized-physical-media-route',
    feeRequired: false,
    feeAmount:
      'No submission fee or mandatory payment is stated. Physical-media production, international postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WPRB explicitly accepts new-music submissions by email at music@wprb.com and prioritizes physical CDs, CD-Rs, LPs, 12-inch, 10-inch and 7-inch records mailed to the Music Director. A human must choose the route, confirm that the release is new and suitable, verify whether the current email route expects attachments, streaming links or downloadable files, and inspect any current metadata, release-window, international-eligibility and rights requirements before outreach. Physical delivery requires manual address confirmation, postage and customs handling. Do not submit automatically or copy unrelated station contacts.',
    notes:
      'Verified on 2026-07-14 from WPRB official Music Submissions, Contact, homepage, schedule and playlist pages. The first-party submission page publishes music@wprb.com and a Music Director postal route, while the Contact page independently labels the same mailbox for music submissions and inquiries. Activity was confirmed through live now-playing data, current daily schedules, recent playlists and July 2026 concert listings. Email verification was limited to repeated first-party publication, valid syntax, same-domain alignment and explicit music-submission purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed, and no email, file, form, package, login, CAPTCHA or payment action was taken.'
  },
  {
    name: 'WCBN-FM 88.3 Physical Album Airplay Submission Route',
    websiteUrl: 'https://wcbn.org/',
    submissionUrl: 'https://wcbn.org/c/',
    sourceUrl: 'https://wcbn.org/c/',
    sourceType: 'automation_run_361_public_research',
    country: 'United States / Ann Arbor, Michigan / University of Michigan student-run freeform radio',
    language: 'en',
    genres: [
      'freeform',
      'independent',
      'electronic',
      'techno',
      'reggae',
      'dancehall',
      'hip-hop',
      'world-music',
      'experimental',
      'college-radio',
      'radio-airplay',
      'physical-submission',
      'manual-review'
    ],
    submissionMethod: 'official-wcbn-hard-copy-album-route-to-wcbn-music-or-relevant-genre-director',
    feeRequired: false,
    feeAmount:
      'No submission fee or mandatory payment is stated. Media production, international postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WCBN states that it accepts music from any musician willing to send a hard copy of an album, preferably CD or vinyl, to WCBN MUSIC at the official station address. Genre-specific albums may be marked care of the relevant genre director. A human must confirm that the selected MarcsMusic release is an eligible album rather than a single, choose an appropriate physical format and genre routing, reconfirm the address, and prepare postage and customs documentation. The Music Directors email action is protected by Cloudflare and was not decoded; it is retained only as an observed first-party business-contact route and must not be used as a digital-submission workaround unless WCBN explicitly authorizes that use during manual review.',
    notes:
      'Verified on 2026-07-14 from WCBN official Contact, homepage and schedule pages. The Contact page lists current Music Directors, publishes the station mailing address and explicitly accepts hard-copy albums in preferably CD or vinyl form. The station states that it broadcasts 24/7 and its site exposes live-listening, recent archives, a current schedule and board terms extending through October and December 2026. The Music Directors address is Cloudflare-protected; it was not decoded, inferred or guessed. No email, form, file, package, login, CAPTCHA, payment, SMTP, MX, catch-all or mailbox-level probe was performed.'
  }
];
