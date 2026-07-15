import type { PlatformInput } from '../models/types.js';
import { run388SeedPlatforms } from './run388PlatformSeeds.js';

export const run387SeedPlatforms: PlatformInput[] = [
  {
    name: 'Subcity Radio Programmes Team Music Submission Process Inquiry Route',
    websiteUrl: 'https://subcity.org/',
    submissionUrl: 'mailto:programmes@subcity.org',
    sourceUrl: 'https://subcity.org/about/',
    sourceType: 'automation_run_387_public_research',
    country: 'United Kingdom / Glasgow volunteer-run freeform university radio',
    language: 'en',
    genres: [
      'student-radio',
      'university-radio',
      'freeform-radio',
      'independent-music',
      'electronic',
      'bass',
      'reggae',
      'world-music',
      'experimental',
      'programmes-team',
      'pre-submission-inquiry',
      'manual-review'
    ],
    submissionMethod: 'official-public-programmes-team-asset-free-music-submission-process-inquiry',
    feeRequired: false,
    feeAmount: 'No inquiry or music-submission fee is stated on the official About page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Subcity Radio’s official About page publishes programmes@subcity.org as its public station contact, but the page does not explicitly authorize unsolicited audio delivery or publish attachment-versus-link rules, accepted formats, file-size limits, metadata or EPK requirements, release windows, international eligibility, clean or explicit-content rules, AI-origin policy, response times or physical-delivery instructions. A human must re-open the official page, send only a concise asset-free inquiry asking whether external artists may submit music for presenter or programme consideration, wait for explicit routing and delivery instructions, permission-check the selected release and avoid parallel outreach to individual contributors or shows.',
    notes:
      'Verified on 2026-07-15 from Subcity Radio’s official homepage, About page and Get Involved page. The About page publishes programmes@subcity.org in plaintext, describes Subcity as a volunteer-run freeform station at the University of Glasgow, states that it has no prescribed playlist and says no genre or concept is off-limits. The address has valid syntax and exact official-domain alignment, but it is retained only for an asset-free process inquiry because it is a general programmes contact and no direct audio-delivery policy is published. Current operation was supported by the live official site’s schedule, shows, events, listen-back and live-listening interfaces, current personnel and year-round show applications. No email, form field, audio file, attachment, streaming or download link, biography, metadata, personal information, physical package, login, CAPTCHA, consent or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  },
  ...run388SeedPlatforms
];
