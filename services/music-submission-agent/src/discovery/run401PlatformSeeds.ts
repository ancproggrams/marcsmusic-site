import type { PlatformInput } from '../models/types.js';
import { run402SeedPlatforms } from './run402PlatformSeeds.js';

export const run401SeedPlatforms: PlatformInput[] = [
  {
    name: 'Overview Music Public Label Demo-Routing Inquiry',
    websiteUrl: 'https://overviewmusic.co.uk/',
    submissionUrl: 'mailto:info@overviewmusic.co.uk',
    sourceUrl: 'https://overviewmusic.co.uk/',
    sourceType: 'automation_run_401_public_research',
    country: 'United Kingdom / Brighton drum-and-bass label with an international catalogue and audience',
    language: 'en',
    genres: [
      'drum-and-bass',
      'electronic',
      'bass-music',
      'deep-dnb',
      'neurofunk-adjacent',
      'public-business-email',
      'asset-free-pre-submission-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-public-label-email-for-asset-free-demo-routing-inquiry',
    feeRequired: false,
    feeAmount:
      'No fee, account, login or mandatory payment is stated for contacting the public label mailbox. The mailbox is not represented as a direct unsolicited-demo delivery route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Overview Music publishes info@overviewmusic.co.uk on its official site, but the reviewed first-party pages do not publish a current unsolicited-demo policy, dedicated upload form, accepted stream or download providers, file formats, attachment limits, release-status rules, rights declarations, content restrictions or AI-origin policy. A human may send only one concise asset-free inquiry asking whether demos are open and requesting the current authorized route and requirements. Do not attach audio, include private track links, use the storefront checkout, repurpose newsletter or social routes, or treat the general mailbox as authorization to deliver music before the label responds.',
    notes:
      'Verified on 2026-07-16 from Overview Music’s official homepage, catalogue, events and radio/podcast surfaces. The homepage publishes info@overviewmusic.co.uk in plaintext, identifies the label as established in Brighton in 2018, exposes a functioning official storefront, and lists an active drum-and-bass catalogue including Klinical, Molecular, Emperor, Trex, Skylark, Creatures and Wingz releases. The public mailbox has valid syntax and exact overviewmusic.co.uk domain alignment, but no dedicated demo purpose is stated, so it is retained only as a routing-inquiry contact. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, form field, newsletter signup, account, checkout, audio asset, attachment, stream, download link, metadata, personal information, login, CAPTCHA, consent or payment was entered or submitted.'
  },
  ...run402SeedPlatforms
];
