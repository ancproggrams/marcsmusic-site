import type { PlatformInput } from '../models/types.js';

export const run328SeedPlatforms: PlatformInput[] = [
  {
    "name": "Critical Music First-Party Demo Submission Form Route",
    "websiteUrl": "https://criticalmusic.com/",
    "submissionUrl": "https://criticalmusic.com/contact/",
    "sourceUrl": "https://criticalmusic.com/contact/",
    "sourceType": "automation_run_328_public_research",
    "country": "United Kingdom / London drum-and-bass and underground electronic label",
    "language": "en",
    "genres": [
      "critical-music",
      "drum-and-bass",
      "jungle",
      "bass-music",
      "electronic",
      "170-bpm",
      "experimental",
      "first-party-form",
      "recaptcha",
      "manual-review"
    ],
    "submissionMethod": "official-first-party-demo-submission-contact-form-320kbps-preferred",
    "feeRequired": false,
    "feeAmount": "No demo-submission fee, account, login or payment requirement is stated on Critical Music's official demo page.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Critical Music explicitly welcomes demos through the first-party contact form, requires the Demo Submission subject and prefers 320-kbps audio, but the page is protected by reCAPTCHA and does not expose the complete live fields, accepted delivery method, rights declarations, attachment limits or consent text in passive review. A human must choose the Demo Submission option, complete any CAPTCHA, inspect all current fields and terms, select an appropriate drum-and-bass or jungle track, verify ownership, approve metadata and submit manually. The public enquiry and operations mailboxes must not be repurposed as demo-delivery addresses.",
    "notes": "Verified on 2026-07-13 from Critical Music's official contact, homepage and releases pages. The contact page states that demo submissions are always welcome, asks users to select Demo Submission in the contact form and says 320 kbps is preferred. The same page declares Google reCAPTCHA protection. Official business addresses info@criticalmusic.com and badger@criticalmusic.com are published for press/general enquiries and label management/operations, not as demo mailboxes; they were checked only for first-party publication, syntax, domain alignment and stated purpose. Current activity is supported by the live official catalogue, including CRIT298 and multiple recent catalogue entries, plus active event and release presentation. No form, CAPTCHA, file, link or email was submitted and no SMTP, MX, catch-all, mailbox or deliverability probe was performed."
  },
  {
    "name": "Shogun Audio Official Demo Portals Route",
    "websiteUrl": "https://www.shogunaudio.co.uk/",
    "submissionUrl": "https://www.labelradar.com/labels/shogunaudio/portal",
    "sourceUrl": "https://www.shogunaudio.co.uk/pages/contact",
    "sourceType": "automation_run_328_public_research",
    "country": "United Kingdom / Brighton drum-and-bass label",
    "language": "en",
    "genres": [
      "shogun-audio",
      "drum-and-bass",
      "liquid-drum-and-bass",
      "dancefloor-drum-and-bass",
      "jungle",
      "bass-music",
      "electronic",
      "third-party-portal",
      "labelradar",
      "label-engine",
      "manual-review"
    ],
    "submissionMethod": "official-demo-navigation-to-labelradar-with-legacy-label-engine-upload-form",
    "feeRequired": false,
    "feeAmount": "Shogun Audio states no mandatory demo fee. The current LabelRadar portal may require an account and may expose optional paid features; live pricing and submission allowances must be reviewed manually.",
    "loginRequired": true,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Shogun Audio's current site navigation sends demos to a LabelRadar portal, creating a third-party account, login, terms and possible pricing boundary. Its official contact page simultaneously links a legacy Label Engine form that allows up to five MP3 uploads without stated login, but the loaded form exposes unresolved template placeholders, so its operational status cannot be trusted automatically. A human must determine which official route is currently valid, review account permissions, pricing, upload limits, consent and rights terms, select a suitable drum-and-bass track and submit manually. General, shop and licensing mailboxes are not demo routes.",
    "notes": "Verified on 2026-07-13 from Shogun Audio's official homepage, contact and events pages plus both linked demo destinations. The current site navigation labels a LabelRadar URL as Demos. The contact page also says Please submit via the Shogun Label Engine demo URL. The legacy form presents stages for contact information, up to five MP3 tracks, optional social profiles and a 500-character message, but unresolved {{demo.NAME}} placeholders were visible during passive review. Shogun's official contact page publishes info@shogunaudio.co.uk for general enquiries, shop@shogunaudio.co.uk for shop matters and licensing@shogunaudio.co.uk for sync/licensing/sample clearance; none is authorized for demos. Activity is supported by the live 2026 site, current release announcements, a 26 September Shogun Sessions event and a 2026 copyright footer. No account, login, form, upload, email, payment, CAPTCHA or portal workflow was used and no SMTP, MX, catch-all, mailbox or deliverability probe was performed."
  }
];
