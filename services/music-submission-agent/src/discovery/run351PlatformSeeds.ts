import type { PlatformInput } from '../models/types.js';

export const run351SeedPlatforms: PlatformInput[] = [
  {
    name: 'Bass Rebels LabelRadar and Streamable-Link Demo Submission Route',
    websiteUrl: 'https://www.bassrebels.co.uk/',
    submissionUrl: 'https://www.bassrebels.co.uk/submitmusic/',
    sourceUrl: 'https://www.bassrebels.co.uk/submitmusic/',
    sourceType: 'automation_run_351_public_research',
    country: 'United Kingdom / global electronic and creator-safe music label',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'future-bass',
      'dubstep',
      'drum-and-bass',
      'lofi',
      'pop',
      'copyright-free',
      'label-demo',
      'labelradar',
      'streamable-link',
      'manual-review'
    ],
    submissionMethod: 'official-bass-rebels-labelradar-primary-and-streamable-link-email-fallback-route',
    feeRequired: false,
    feeAmount:
      'No mandatory demo-submission fee is stated on the official Bass Rebels submission page. The primary LabelRadar path may expose account, credit or plan boundaries at runtime and must be checked manually.',
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Bass Rebels directs demos primarily to LabelRadar and provides an authorized fallback email link when LabelRadar is unavailable. The first-party LabelRadar link resolved as a broken relative path during passive verification, and the fallback address was not exposed in plaintext. A human must open the current official page, use only the displayed route, inspect any LabelRadar account, credit, terms or runtime-verification boundary, prepare a streamable SoundCloud or Dropbox link, verify track rights and metadata, and submit or send manually.',
    notes:
      "Verified on 2026-07-14 from Bass Rebels' official homepage, Submit Music page and Contact page. The submission page authorizes LabelRadar and a fallback email link, and requires the fallback delivery to contain only a streamable link such as SoundCloud or Dropbox. The Contact page explicitly routes artists with their own music to the Submit Music page. The public licensing@bassrebels.co.uk address is restricted to commercial licensing and was excluded from demo routing. Current release content and the site's 2026 copyright notice confirm activity. No account, login, form, email, streamable link, upload, payment or anti-bot control was used; the protected or unrendered fallback destination was not decoded or guessed, and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed."
  }
];
