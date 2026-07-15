import type { PlatformInput } from '../models/types.js';

export const run386SeedPlatforms: PlatformInput[] = [
  {
    name: 'University Radio York Music Team Airplay Process Inquiry Route',
    websiteUrl: 'https://ury.org.uk/',
    submissionUrl: 'mailto:music@ury.org.uk',
    sourceUrl: 'https://ury.org.uk/contact/',
    sourceType: 'automation_run_386_public_research',
    country: 'United Kingdom / York student-run university radio',
    language: 'en',
    genres: [
      'student-radio',
      'university-radio',
      'independent-music',
      'new-music',
      'specialist-music',
      'live-sessions',
      'music-team',
      'airplay-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-public-music-team-airplay-pre-submission-inquiry-email',
    feeRequired: false,
    feeAmount: 'No inquiry or music-submission fee is stated on the official contact page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'University Radio York’s official Contact page publishes music@ury.org.uk for its Music Team and explicitly invites musicians or up-and-coming bands seeking airtime to contact the team. The page does not publish attachment-versus-link rules, accepted formats, file-size limits, metadata or EPK requirements, release windows, international eligibility, clean or explicit-content rules, AI-origin policy, response times or physical-delivery instructions. A human must re-open the current page, send only a concise asset-free process inquiry, wait for explicit delivery instructions, permission-check the selected release and avoid parallel outreach to management, programme, newsroom, production or general contacts.',
    notes:
      'Verified on 2026-07-15 from University Radio York’s official homepage, Contact page and About page. The Contact page publishes music@ury.org.uk in plaintext under Music Team and invites musicians and up-and-coming bands seeking airtime to get in touch. The address has valid syntax, uses the official ury.org.uk domain and is purpose-bound to the Music Team, but it is retained only for an asset-free process inquiry because no direct audio-delivery specification is published. Current operation was confirmed through official June 2026 Open Days broadcasts and podcasts, while the About page documents term-time 24-hour broadcasting, worldwide web access, specialist music shows, music journalism and live sessions. No email, form field, file, link, login, CAPTCHA, consent or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  }
];
