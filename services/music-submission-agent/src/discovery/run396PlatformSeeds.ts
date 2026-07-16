import type { PlatformInput } from '../models/types.js';

export const run396SeedPlatforms: PlatformInput[] = [
  {
    name: 'KOOP Radio 91.7 FM Music Library Submission Inquiry Route',
    websiteUrl: 'https://koop.org/',
    submissionUrl: 'https://koop.org/about-us/contact/',
    sourceUrl: 'https://koop.org/about-us/contact/',
    sourceType: 'automation_run_396_public_research',
    country: 'United States / Austin, Texas nonprofit community radio',
    language: 'en',
    genres: [
      'community-radio',
      'independent-music',
      'electronic',
      'electronica',
      'dub',
      'reggae',
      'jungle-drum-and-bass',
      'hip-hop',
      'world-music',
      'world-beat',
      'public-business-email',
      'asset-free-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-library-email-asset-free-process-inquiry',
    feeRequired: false,
    feeAmount:
      'KOOP publishes no submission fee, login, platform account or mandatory payment for contacting its Music Library. The queued action is a free, asset-free process inquiry until KOOP confirms its current technical delivery requirements.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KOOP’s official Contact page states that its Music Library welcomes music submissions and publishes music@koop.org for that purpose. The page does not specify whether audio should be attached or supplied by downloadable link, accepted formats or sizes, metadata, release windows, international eligibility, clean-edit requirements or AI-origin policy. A human may send one concise, asset-free inquiry to music@koop.org requesting the current authorized procedure. Do not attach audio, include private links, contact individual programmers or use the adjacent newsletter form unless KOOP first confirms the delivery method. Stop if the live route introduces login, CAPTCHA, payment, consent or another protected workflow.',
    notes:
      'Verified on 2026-07-16 from KOOP Radio’s official homepage, Contact page, staff page and Music Genres and Definitions page. The official Contact page publishes music@koop.org in plaintext and explicitly says the Music Library welcomes music submissions. The mailbox has valid syntax and exact alignment with KOOP’s official koop.org domain. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. Current operation was confirmed through official site updates dated July 15, 2026, programme highlights dated July 14, 2026, upcoming July and August 2026 events, a live-listening interface and current station governance. KOOP’s official genre taxonomy and linked programmes cover electronica, ambient, house, techno, dub, reggae, jungle/drum and bass, hip-hop, world and world-beat, providing plausible fit for selected MarcsMusic releases. The newsletter form and its anti-spam honeypot field are unrelated to music delivery and were excluded. No email, form field, audio file, attachment, link, login, CAPTCHA or payment was submitted.'
  }
];
