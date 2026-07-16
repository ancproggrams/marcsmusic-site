import type { PlatformInput } from '../models/types.js';

export const run403SeedPlatforms: PlatformInput[] = [
  {
    name: 'KGNU Community Radio Music Department Routing Inquiry',
    websiteUrl: 'https://kgnu.org/',
    submissionUrl: 'https://kgnu.org/contact-us/',
    sourceUrl: 'https://kgnu.org/contact-us/',
    sourceType: 'automation_run_403_public_research',
    country: 'United States / Boulder and Denver, Colorado community radio with worldwide online listening',
    language: 'en',
    genres: [
      'community-radio',
      'freeform-radio',
      'independent-music',
      'reggae',
      'dub',
      'world-music',
      'afrobeat',
      'electronic',
      'cross-genre',
      'asset-free-pre-submission-inquiry',
      'captcha-protected-form',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-contact-form-music-department-asset-free-routing-inquiry',
    feeRequired: false,
    feeAmount:
      'No submission fee, account, login or mandatory payment is stated for the public contact form. The form is not an authorized direct audio-delivery route.',
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KGNU publishes a first-party Contact Staff or DJ form with a Music department option and reCAPTCHA v3, and its current Team page identifies Indra Raj as Music Director. The reviewed official pages do not publish a dedicated unsolicited-music submission form, public Music Department email, accepted audio-delivery method, formats, file-size limits, international eligibility, metadata requirements, release timing, explicit-content rules or AI-origin policy. A human may use the protected form only for one concise asset-free process inquiry selecting Music. Do not automate or bypass reCAPTCHA, do not attach or include music links, and do not contact individual DJs or infer an email address. Supply music only after KGNU returns an authorized route and requirements.',
    notes:
      'Verified on 2026-07-16 from KGNU’s official homepage, Contact Us page, Team page and current programme pages. The contact page provides first name, last name, email, phone, department and message fields, includes Music as a selectable department and displays reCAPTCHA v3. The Team page identifies Indra Raj as Music Director but publishes no plaintext address. Current operation was supported by the live broadcast interface, homepage content dated July 14-15, 2026 and current programme pages. Genre fit is strong for selected MarcsMusic material: Reggae Bloodlines covers reggae, ska, rock steady, dub and dancehall; TerraSonic covers international freeform styles including Asian dub, Afro-beat and Indian breaks; Musica Mundi spans global traditional and contemporary recordings. No business email was guessed, decoded or obtained from a third-party source. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No form field, CAPTCHA response, email, audio, attachment, link, login, consent or payment was submitted.'
  }
];
