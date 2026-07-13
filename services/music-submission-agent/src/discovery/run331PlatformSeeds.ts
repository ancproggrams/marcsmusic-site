import type { PlatformInput } from '../models/types.js';

export const run331SeedPlatforms: PlatformInput[] = [
  {
    name: 'Ophelia Records Official Demo Email Route',
    websiteUrl: 'https://opheliarecords.com/',
    submissionUrl: 'https://opheliarecords.com/contact/',
    sourceUrl: 'https://opheliarecords.com/contact/',
    sourceType: 'automation_run_331_public_research',
    country: 'United States / global melodic-bass, dubstep, trance, drum-and-bass and electronic label',
    language: 'en',
    genres: [
      'ophelia-records',
      'melodic-bass',
      'melodic-dubstep',
      'dubstep',
      'trance',
      'psytrance',
      'drum-and-bass',
      'house',
      'electronic',
      'direct-demo-email',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-purpose-specific-demo-email',
    feeRequired: false,
    feeAmount: 'No submission fee or payment requirement is stated on the official contact page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'Ophelia Records publishes demos@opheliarecords.com specifically for demos but does not publish complete delivery instructions, attachment limits, accepted link providers, release-status rules, rights declarations, response times or submission-frequency limits. A human must confirm label and track fit, prepare an authorized private streaming or non-expiring download route rather than assuming attachments are accepted, review all metadata and rights, approve the pitch and personal data, and send the email manually. The separate general-inquiries mailbox must not be used for demo delivery.',
    notes: 'Verified on 2026-07-13 from Ophelia Records first-party contact, about and music archive pages. The official contact page publishes demos@opheliarecords.com specifically for demos and info@opheliarecords.com for general inquiries. Both addresses are syntactically valid, purpose-labelled and match the first-party domain; only the demo address is an authorized submission route. Ophelia describes its catalogue as melodic bass, dubstep, trance, psytrance, drum-and-bass, house and related electronic music, making it relevant to selected MarcsMusic releases. Current activity was confirmed by multiple releases listed for 2026, including Free, Weightless EP, Haunt U, Hurricane, Wake Up, Trace The Echoes and OPIA EP. No email, demo, track, attachment, link, biography, metadata, rights declaration, consent or personal data was prepared or sent, and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed.'
  }
];
