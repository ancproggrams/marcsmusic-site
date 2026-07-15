import type { PlatformInput } from '../models/types.js';

export const run372SeedPlatforms: PlatformInput[] = [
  {
    name: 'Local 107.3 FM CFMH Digital Music Submission Route',
    websiteUrl: 'https://localfm.ca/',
    submissionUrl: 'https://localfm.ca/contact/',
    sourceUrl: 'https://localfm.ca/contact/',
    sourceType: 'automation_run_372_public_research',
    country: 'Canada / Saint John, New Brunswick campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'dub',
      'reggae',
      'hip-hop',
      'global-music',
      'campus-radio',
      'community-radio',
      'email-submission',
      'digital-music-submission',
      'manual-review'
    ],
    submissionMethod: 'official-station-manager-email-for-digital-music-submissions',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Local 107.3 FM explicitly directs digital music submissions to manager@cfmh.ca, but its public guidance does not state accepted file formats, attachment-versus-download-link rules, track-count requirements, metadata, release timing, international eligibility, explicit-content handling or AI-origin restrictions. A human must recheck the current guidance, select a suitable MarcsMusic release, prepare only permitted assets or links, send manually to the published Station Manager mailbox, and stop if a login, CAPTCHA, payment, consent request or updated restriction appears.',
    notes:
      'Verified on 2026-07-15 from Local 107.3 FM’s official Contact page and active homepage. The Contact page names Station Manager Brandon Logan and directly states that digital music submissions may be sent to manager@cfmh.ca. The homepage contains a current Earth Day post dated 2026-04-21, a 25th-anniversary post dated 2026-01-12, a live-listening link and a current schedule link. The published postal address was retained only as adjacent station contact information because the page does not expressly authorize physical music submissions. Email verification covered first-party publication, valid syntax, official cfmh.ca domain alignment and explicit digital-submission purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No email, file, link, form, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'Radio Western 94.9 FM Dedicated Music Submission Email Route',
    websiteUrl: 'https://radiowestern.ca/',
    submissionUrl: 'https://radiowestern.ca/',
    sourceUrl: 'https://radiowestern.ca/',
    sourceType: 'automation_run_372_public_research',
    country: 'Canada / London, Ontario campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'dub',
      'reggae',
      'hip-hop',
      'global-music',
      'campus-radio',
      'community-radio',
      'email-submission',
      'temporary-service-outage',
      'manual-review'
    ],
    submissionMethod: 'official-dedicated-music-email-published-on-temporary-station-status-page',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Radio Western’s official temporary status page explicitly directs new music submissions and promotion to music@radiowestern.ca and expressly says not to use the general station mailbox. The main website is unavailable after a hardware failure, so current requirements for formats, attachments or download links, metadata, release windows, international eligibility, explicit-content handling and AI-origin policy cannot be confirmed. A human must recheck the station after service restoration, verify the current submission rules, use only the dedicated music mailbox, send manually, and stop if any login, CAPTCHA, payment, consent or updated restriction appears.',
    notes:
      'Verified on 2026-07-15 from Radio Western’s first-party temporary status page. The page reports a web-server hardware failure caused by AC power fluctuations, states that the station stream remains available through radio apps and Apple Music, and says archives continue to be created. It publishes music@radiowestern.ca specifically for new music submissions and promotion while excluding someone@radiowestern.ca from that purpose. Email verification covered first-party publication, valid syntax, official radiowestern.ca domain alignment and explicit submission purpose. No SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. No general mailbox was substituted, and no email, file, link, form, login, CAPTCHA or payment was submitted.'
  }
];
