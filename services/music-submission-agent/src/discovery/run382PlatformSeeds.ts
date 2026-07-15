import type { PlatformInput } from '../models/types.js';

export const run382SeedPlatforms: PlatformInput[] = [
  {
    name: 'Eastside Radio 89.7FM Music Enquiries Pre-Submission Email Route',
    websiteUrl: 'https://eastsidefm.org/',
    submissionUrl: 'mailto:music@eastsidefm.org',
    sourceUrl: 'https://eastsidefm.org/contact/',
    sourceType: 'automation_run_382_public_research',
    country: 'Australia / Sydney, New South Wales community radio',
    language: 'en',
    genres: [
      'community-radio',
      'independent',
      'electronic',
      'dub',
      'reggae',
      'hip-hop',
      'world-music',
      'african',
      'soul',
      'future-rnb',
      'jazz',
      'music-enquiries',
      'pre-submission-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-public-music-enquiries-email-asset-free-pre-submission-inquiry',
    feeRequired: false,
    feeAmount: 'No fee or mandatory payment is stated for the official Music enquiries mailbox.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Eastside Radio’s official Contact page publishes music@eastsidefm.org specifically for Music enquiries, but it does not publish current unsolicited-audio delivery rules, accepted attachments or links, formats, metadata, release timing, international eligibility, explicit-content policy or AI-origin policy. A human may first send only an asset-free inquiry asking for the current music or airplay submission procedure. Do not attach audio or include private streaming or download links until Eastside confirms an authorized delivery route and requirements.',
    notes:
      'Verified on 2026-07-15 from Eastside Radio’s official Contact, Programs, homepage and current editorial pages. The mailbox was checked for plaintext first-party publication, valid syntax, exact stated Music-enquiries purpose and eastsidefm.org domain alignment only; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. Separate general, Music Interviews, programming, reviews, arts and individual-show contacts were not repurposed. Eastside broadcasts 24/7, published current June 2026 material and lists electronic, dub, reggae, hip-hop and world programmes. No email, audio, link, attachment, metadata, login, consent or payment was sent.'
  },
  {
    name: 'Northside Radio 99.3FM Music Contact Form Pre-Submission Inquiry Route',
    websiteUrl: 'https://www.northsideradio.com.au/',
    submissionUrl: 'https://www.northsideradio.com.au/contact/',
    sourceUrl: 'https://www.northsideradio.com.au/contact/',
    sourceType: 'automation_run_382_public_research',
    country: 'Australia / Chatswood, Sydney, New South Wales community radio',
    language: 'en',
    genres: [
      'community-radio',
      'independent',
      'electronic',
      'dance',
      'soul',
      'funk',
      'jazz',
      'blues',
      'latin',
      'world-music',
      'contact-form',
      'pre-submission-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-public-contact-form-music-category-asset-free-pre-submission-inquiry',
    feeRequired: false,
    feeAmount: 'No fee or mandatory payment is stated for the official enquiry form.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Northside Radio’s official Contact page provides an enquiry form with a dedicated Music subject, but it does not expressly authorize unsolicited audio delivery or publish file, link, metadata, release-window, international-eligibility, explicit-content or AI-origin requirements. The passive page did not expose a file upload, CAPTCHA, login or payment step, but live validation and anti-spam controls must be rechecked. A human may use the Music category only for an asset-free inquiry asking for the current airplay-submission process and must not send music or private links until Northside confirms an authorized route.',
    notes:
      'Verified on 2026-07-15 from Northside Radio’s official homepage and Contact page. The first-party form exposes required name, email, subject and message fields, an optional phone field and a Music subject option. The official homepage exposes Listen Live, Program Guide, Song History and News surfaces and an active station-support campaign. No purpose-bound public music-submission email was observed, and the street address was not interpreted as authorization for physical music delivery. No form field, audio, link, attachment, personal information, login, CAPTCHA, consent or payment was entered or submitted.'
  }
];
