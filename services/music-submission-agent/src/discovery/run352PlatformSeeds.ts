import type { PlatformInput } from '../models/types.js';

export const run352SeedPlatforms: PlatformInput[] = [
  {
    name: 'Edge Radio 99.3FM Global Digital and Physical Music Submission Route',
    websiteUrl: 'https://www.edgeradio.org.au/',
    submissionUrl: 'https://www.edgeradio.org.au/submit-your-music/',
    sourceUrl: 'https://www.edgeradio.org.au/submit-your-music/',
    sourceType: 'automation_run_352_public_research',
    country: 'Australia / Hobart, Tasmania / global independent youth community radio',
    language: 'en',
    genres: [
      'electronic',
      'experimental',
      'digital-beats',
      'hip-hop',
      'reggae',
      'dub',
      'world-music',
      'alternative',
      'independent',
      'new-music',
      'radio-airplay',
      'email-submission',
      'physical-submission',
      'manual-review'
    ],
    submissionMethod: 'official-edge-radio-digital-email-and-optional-physical-music-route',
    feeRequired: false,
    feeAmount:
      'No mandatory music-submission fee is stated. Edge Radio separately offers optional paid promotional campaigns, which are not required for editorial airplay consideration.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Edge Radio accepts worldwide digital submissions through the dedicated email link on its official submission page and optional physical CDs by post. Digital delivery requires a short bio, upcoming gig details where relevant, a stream link and a high-quality download link in an accepted format. The dedicated email destination is Cloudflare-protected in the passive page representation and was not decoded. A human must open the current official page, use only the displayed destination, avoid falsely marking the submission as Tasmanian, choose a rights-cleared MarcsMusic release, prepare the required links and metadata, and send manually.',
    notes:
      "Verified on 2026-07-14 from Edge Radio's official Submit Your Music page, homepage and program guide. Edge Radio explicitly supports emerging artists in Tasmania, Australia and around the world. Digital submissions require a short bio, relevant gig details, a streaming link and a high-quality download link; accepted formats include 320 kbps MP3, AAC, WAV, FLAC and OGG. The station also authorizes physical CDs addressed to its Music Department and suggests multiple copies for distribution to relevant programs. Only genuine Tasmanian artists may use the Tasmanian Music Submission subject marker. The current guide includes recurring New Music on Edge Radio blocks plus electronic, experimental, digital-beat, hip-hop, reggae and world-music programming, while July 2026 homepage posts confirm current activity. Optional promotional campaigns were recorded as adjacent paid promotion, not as a submission fee or airplay requirement. The dedicated music-submission email link was Cloudflare-protected and was not decoded or guessed. No email, stream, download, attachment, package, payment, CAPTCHA, authentication or anti-bot control was used, and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed."
  },
  {
    name: 'SYN Media 90.7FM Rolling Music Submission Email Route',
    websiteUrl: 'https://www.syn.org.au/',
    submissionUrl: 'https://www.syn.org.au/contact',
    sourceUrl: 'https://www.syn.org.au/contact',
    sourceType: 'automation_run_352_public_research',
    country: 'Australia / Melbourne / youth-run community radio and music media',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'independent',
      'alternative',
      'pop',
      'hip-hop',
      'new-music',
      'youth-radio',
      'radio-airplay',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-syn-media-dedicated-music-submission-email-route',
    feeRequired: false,
    feeAmount: 'No music-submission fee or mandatory payment is stated on the official SYN Media contact page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'SYN Media accepts music through the publicly listed purpose-bound mailbox music@syn.org.au. The email must contain a non-expiring or otherwise reliable download link to 320 kbps MP3 or WAV files, not direct attachments, together with a press release or artist bio, title, release date and relevant web, social, gig and previous-release links. The page does not expressly state international eligibility or AI-origin rules. A human must confirm current eligibility, select a suitable rights-cleared MarcsMusic release, prepare the required metadata and links, and send the email manually.',
    notes:
      "Verified on 2026-07-14 from SYN Media's official Contact, Reviews and Schedule pages. The Contact page publishes music@syn.org.au specifically for music submissions and states that Music Directors review submissions on a rolling basis. Required delivery is a download link for 320 kbps MP3 or WAV audio; files must not be attached directly. Required supporting material includes a press release or artist bio, track or EP/album title, release date and relevant website, social, upcoming-gig and prior-release links. The separate music.content@syn.org.au mailbox is for interview requests and was not queued as a duplicate airplay route. Current 2026 staff listings, a live schedule page and music coverage through May 2026, including electronic-festival coverage, confirm operation. The page does not publish a submission fee, login, CAPTCHA or payment requirement. Email verification was limited to first-party plaintext publication, valid syntax, exact music-submission purpose and syn.org.au domain alignment; no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, download link, audio, attachment, biography, metadata, personal information or rights declaration was sent."
  }
];
