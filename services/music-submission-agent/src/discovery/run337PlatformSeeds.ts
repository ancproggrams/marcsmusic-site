import type { PlatformInput } from '../models/types.js';

export const run337SeedPlatforms: PlatformInput[] = [
  {
    name: 'Eatbrain Official Demo Email Route',
    websiteUrl: 'https://eatbrain.net/',
    submissionUrl: 'mailto:mailstoeatbrain@gmail.com',
    sourceUrl: 'https://eatbrain.net/contact',
    sourceType: 'automation_run_337_public_research',
    country: 'Hungary / international neurofunk drum-and-bass label and events brand',
    language: 'en',
    genres: [
      'eatbrain',
      'neurofunk',
      'drum-and-bass',
      'dark-drum-and-bass',
      'techstep',
      'bass-music',
      'electronic',
      'independent-label',
      'demo-submission',
      'manual-review'
    ],
    submissionMethod: 'official-public-demo-email',
    feeRequired: false,
    feeAmount: 'No submission fee, account, login, CAPTCHA or mandatory payment is stated for the officially published demo email route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'Eatbrain explicitly accepts demos at mailstoeatbrain@gmail.com with the subject “DEMO” and either a download link or private SoundCloud link. A human must select a genre-appropriate track, verify ownership and release status, approve the private or downloadable link and any personal data, prepare the email, reconfirm the published address and send it manually. The separate booking address is not authorized for demo delivery.',
    notes: 'Verified on 2026-07-13 from Eatbrain’s official homepage and contact page. The contact page publishes mailstoeatbrain@gmail.com specifically for demo submissions and instructs senders to use the subject “DEMO” plus a download link or private SoundCloud link. The official homepage describes Eatbrain as premier neurofunk drum-and-bass and shows current releases and podcasts, including MIDNIGHT CVLT – Apocalypse dated 2026-07-10, Burr Oak – Badlands dated 2026-06-29 and Sitri – Minerva dated 2026-06-22, confirming current activity. tom@clockworkartists.co.uk is separately published for booking an Eatbrain Night and was excluded as a submission route. The demo mailbox is an officially published external Gmail address rather than an Eatbrain-domain mailbox; validation was limited to official publication, syntax and stated purpose. No email, track, link, metadata or personal data was sent, and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed.'
  }
];
