import type { PlatformInput } from '../models/types.js';

export const run336SeedPlatforms: PlatformInput[] = [
  {
    name: 'High Tea Music Official Demo Form Route',
    websiteUrl: 'https://highteamusic.nl/',
    submissionUrl: 'https://highteamusic.fillout.com/demo-form',
    sourceUrl: 'https://highteamusic.nl/contact/',
    sourceType: 'automation_run_336_public_research',
    country: 'Netherlands / Amsterdam-based drum-and-bass label with an international electronic-music audience',
    language: 'en',
    genres: [
      'high-tea-music',
      'drum-and-bass',
      'melodic-bass',
      'bass-music',
      'electronic',
      'dance',
      'independent-label',
      'demo-submission',
      'manual-review'
    ],
    submissionMethod: 'official-public-external-demo-form',
    feeRequired: false,
    feeAmount: 'No submission fee or mandatory payment is stated on the official demo or contact route. The linked form is hosted by Fillout and must be reviewed at runtime before any data is entered.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'High Tea Music directs demos exclusively to its official external Fillout form. The form could not be passively rendered during verification, so a human must inspect the live fields, privacy and rights declarations, accepted link or upload formats, any login, CAPTCHA, anti-spam or consent controls, and the final submission action. The publicly listed label and general business emails are not authorized substitutes for the demo form.',
    notes: 'Verified on 2026-07-13 from the official High Tea Music homepage, contact page and release catalogue. The contact page states that demos for the label must be sent through the linked Demo Form. The official site describes the company as an Amsterdam-based drum-and-bass and melodic-bass label founded in 2016 and displays multiple 2026 releases, confirming current activity. Public first-party business addresses include shop@highteamusic.nl, tickets@highteamusic.nl, Philippe@highteamusic.nl, releases@highteamusic.nl and contact@highteamusic.nl; none is published as a demo-delivery mailbox. No form was submitted, no field was populated, no login or CAPTCHA was attempted, no payment was made, no contact was guessed and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed.'
  },
  {
    name: 'Fokuz Recordings Official Demo Email Route',
    websiteUrl: 'https://fokuzrecordings.com/',
    submissionUrl: 'mailto:marco@triplevision.nl',
    sourceUrl: 'https://fokuzrecordings.com/contact/',
    sourceType: 'automation_run_336_public_research',
    country: 'Netherlands / Rotterdam-based soulful drum-and-bass label with global digital distribution',
    language: 'en',
    genres: [
      'fokuz-recordings',
      'drum-and-bass',
      'soulful-drum-and-bass',
      'liquid-drum-and-bass',
      'jungle',
      'electronic',
      'bass-music',
      'independent-label',
      'demo-submission',
      'manual-review'
    ],
    submissionMethod: 'official-public-demo-email',
    feeRequired: false,
    feeAmount: 'No submission fee, account, login, CAPTCHA or mandatory payment is stated for the published demo email route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'Fokuz Recordings explicitly publishes marco@triplevision.nl for demos, but does not provide complete instructions for attachment limits, preferred private-stream or download providers, track count, release status, rights declarations, response expectations or submission frequency. A human must select a genre-appropriate track, verify ownership and release status, prepare a concise pitch and approved link or file method, confirm the current address and send the email manually. The adjacent contact form contains an anti-spam-style “For Official Use Only” field and is not needed for the authorized demo route.',
    notes: 'Verified on 2026-07-13 from the official Fokuz Recordings homepage, contact page and release catalogue. The contact page states “DEMOS TO: marco@triplevision.nl” and identifies Fokuz as part of Triple Vision Music Group in Rotterdam. The official site describes the label as “Soulful Drum & Bass Since 1999,” displays current products marked New and maintains an extensive active release catalogue. distribution@triplevision.nl is also publicly listed for PayPal or business use but is not a demo-submission address. The first-party contact form was not used and its apparent anti-spam field was not touched. No email, file, stream, download, biography, metadata or personal data was sent; no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed.'
  }
];
