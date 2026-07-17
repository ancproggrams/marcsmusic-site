import type { PlatformInput } from '../models/types.js';

export const run419SeedPlatforms: PlatformInput[] = [
  {
    name: 'FBi.radio Free Digital Music-Servicing Opportunity',
    websiteUrl: 'https://www.fbi.radio/',
    submissionUrl: 'https://www.fbi.radio/pages/music-submissions',
    sourceUrl: 'https://www.fbi.radio/pages/music-submissions',
    sourceType: 'automation_run_419_public_research',
    country:
      'Australia / Sydney community radio with digital servicing from Australia and beyond; international artist eligibility not explicitly guaranteed',
    language: 'en',
    genres: [
      'community-radio',
      'independent-music',
      'emerging-artists',
      'electronic',
      'club',
      'bass',
      'ambient',
      'experimental',
      'world',
      'soul',
      'reggae-adjacent',
      'general-music-director-email',
      'specialist-program-email-alternatives',
      'stream-link-required',
      'download-link-required',
      'mp3-320-or-wav',
      'digital-only',
      'no-cd-submissions',
      'weekly-wednesday-auditioning',
      'no-visible-payment-requirement',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-digital-email-servicing-via-general-music-director-or-one-best-fit-specialist-program-contact',
    feeRequired: false,
    feeAmount:
      'The official music-submission instructions publish a free digital servicing workflow. Sponsorship, promotional campaigns, supporter membership and giveaways are adjacent commercial or supporter routes and are excluded.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'FBi.radio requires a curated email with a clear subject, short bio, press image or relevant gig context, a stream link and a free high-quality 320 kbps MP3 or WAV download link. A human must select exactly one route—general music servicing or one best-fit specialist program—confirm international eligibility, release timing, rights, explicit-content handling, metadata, link permissions and the current AI-origin policy, then review and send the email manually. Do not mass-service the same release to multiple presenters.',
    notes:
      'Verified on 2026-07-17 from FBi.radio’s official Music Submissions, Contact, Schedule and current program pages. The general mailbox music@fbiradio.com is published for music submissions on two first-party pages. The official workflow accepts digital servicing only, asks for both stream and free download links, specifies 320 kbps MP3 or WAV, auditions music on Wednesdays and says submissions are normally listened to within 2–3 weeks. Direct specialist servicing is explicitly authorized when the release fits a particular show. Relevant current first-party alternatives include deepweb@fbiradio.com for emerging internet microgenres, aeddan.c@fbiradio.com for ambient and soundscape material, and izzy.page@fbiradio.com for electronic, R&B and punk-adjacent selections. Exactly one route should be chosen. No email, link, file, form, login, CAPTCHA, payment or promotional purchase was submitted.'
  }
];
