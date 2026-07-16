import type { PlatformInput } from '../models/types.js';
import { run399SeedPlatforms } from './run399PlatformSeeds.js';

export const run398SeedPlatforms: PlatformInput[] = [
  {
    name: 'Release Music Magazine Promotion Material Submission Route',
    websiteUrl: 'https://www.releasemagazine.net/',
    submissionUrl: 'https://www.releasemagazine.net/contact/',
    sourceUrl: 'https://www.releasemagazine.net/contact/',
    sourceType: 'automation_run_398_public_research',
    country: 'Sweden / international alternative music web magazine',
    language: 'en',
    genres: [
      'online-music-magazine',
      'alternative',
      'electronic',
      'darkwave',
      'synthpop',
      'industrial',
      'experimental',
      'post-punk',
      'cinematic-electronica',
      'music-review',
      'public-business-email',
      'authorized-promotion-material-route',
      'physical-package-alternative',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-editorial-email-or-postal-promotion-material-route',
    feeRequired: false,
    feeAmount:
      'Release Music Magazine states no editorial submission fee, account, login or mandatory payment requirement. Email delivery is free-first; any optional physical package production and international postage remain the sender’s responsibility.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Release Music Magazine’s official Contact page expressly welcomes record companies, organisers, PR companies, artists and others to send information and promotion material to its public info address or Gothenburg postal address. The page does not publish accepted audio formats, attachment limits, download-link requirements, metadata fields, release windows, clean-edit rules, AI-origin policy or response timing. A human must select a genuinely relevant MarcsMusic alternative/electronic release, prepare a concise editorial pitch, prefer non-expiring public streaming and permissioned download links over unsolicited large attachments, and confirm any live requirements before sending. Use only the canonical info address shown by the magazine; do not contact individual writers or reuse deprecated staff addresses.',
    notes:
      'Verified on 2026-07-16 from Release Music Magazine’s official homepage, Contact, About and Staff pages. The Contact page publishes info (at) releasemagazine dot net, explicitly says artists and other music-industry parties are welcome to send information and promotion material, and notes that the publication receives 5–20 submissions per day. The Staff page repeats the same central mailbox and instructs senders not to use old named addresses. The canonical address info@releasemagazine.net was normalized only from that explicit first-party human-readable notation; it has valid syntax and exact alignment with the official releasemagazine.net domain. Current operation was confirmed through official posts dated June 8, 15, 18 and 28, 2026, current reviews, playlists and an active editorial staff page. Coverage includes international alternative music, electronic music, darkwave, synthpop, industrial, post-punk and cinematic electronica. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, form field, audio file, attachment, link, physical package, login, consent or payment was submitted.'
  },
  ...run399SeedPlatforms
];
