import type { PlatformInput } from '../models/types.js';

export const run13SeedPlatforms: PlatformInput[] = [
  {
    name: 'Create Music Group Artist and Label Growth Route',
    websiteUrl: 'https://createmusicgroup.com/',
    submissionUrl: 'https://createmusicgroup.com/',
    sourceUrl: 'https://createmusicgroup.com/',
    sourceType: 'automation_run_13_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'dance', 'hip-hop', 'pop', 'independent', 'label-services'],
    submissionMethod: 'artist-label-services-contact-route-needs-manual-eligibility-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Create Music Group is an active artist, label, distribution, rights management and marketing route, but the current intake requires human fit review, possible client-portal access and deal/rights checks before outreach or submission.',
    notes:
      'Public research verified global reach, artist/manager and independent-label positioning, client login and get-in-touch route. A visible billing email was not stored as a submission contact. No account, payment, protected portal or form submission was attempted.'
  },
  {
    name: 'Virgin Music Group Label and Artist Services Route',
    websiteUrl: 'https://www.virginmusic.com/',
    submissionUrl: 'https://www.virginmusic.com/',
    sourceUrl: 'https://www.virginmusic.com/',
    sourceType: 'automation_run_13_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'independent', 'label-services'],
    submissionMethod: 'global-label-artist-services-route-needs-human-qualification',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Virgin Music Group is a global distribution and label-services route for labels and artist partners, but eligibility, regional routing, rights, metadata, deal scope and any portal requirements must be reviewed manually.',
    notes:
      'Research verified global distribution and label/artist services relevance. Treated as a strategic partner route, not an auto-submit form.'
  },
  {
    name: 'Believe Artist Services and Distribution Route',
    websiteUrl: 'https://www.believe.com/',
    submissionUrl: 'https://www.believe.com/',
    sourceUrl: 'https://www.believe.com/',
    sourceType: 'automation_run_13_public_research',
    country: 'France / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'pop', 'independent', 'artist-services'],
    submissionMethod: 'artist-services-distribution-route-needs-rights-and-compliance-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Believe is relevant for independent artist services and distribution, but onboarding, territory, catalogue, rights, compliance and current legal/policy considerations require manual review before any contact or upload workflow.',
    notes:
      'Added as a manual-review distribution and artist-services opportunity. No account workflow, protected portal, upload, SMTP probe or email capture was performed.'
  },
  {
    name: 'EMPIRE Distribution and Publishing Route',
    websiteUrl: 'https://www.empi.re/',
    submissionUrl: 'https://www.empi.re/',
    sourceUrl: 'https://www.empi.re/',
    sourceType: 'automation_run_13_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'afrobeats', 'hip-hop', 'publishing'],
    submissionMethod: 'distribution-publishing-and-label-services-route-needs-manual-deal-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'EMPIRE is an active distribution, publishing and label-services opportunity, but routing is deal-based and requires human review of catalogue fit, rights, territory, publishing scope and contact path.',
    notes:
      'Research verified activity across distribution, publishing and global label services. No submission form was mapped safely enough for auto-queueing.'
  },
  {
    name: 'Labelcaster Artist and Label Distribution Route',
    websiteUrl: 'https://labelcaster.com/',
    submissionUrl: 'https://labelcaster.com/',
    sourceUrl: 'https://labelcaster.com/',
    sourceType: 'automation_run_13_public_research',
    country: 'Sweden / global',
    language: 'en',
    genres: ['all', 'electronic', 'dance', 'independent', 'label-services'],
    submissionMethod: 'artist-label-distribution-platform-needs-account-and-rights-review',
    loginRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'Labelcaster is a distribution platform for independent labels and artists, but release upload, DSP delivery, royalty splits, metadata and ownership checks require account-based manual review.',
    notes:
      'Research verified global DSP distribution relevance including artist/label release workflows. No account, upload or protected workflow was accessed.'
  },
  {
    name: 'Proton Radio and Proton Music Electronic Discovery Route',
    websiteUrl: 'https://www.protonradio.com/',
    submissionUrl: 'https://www.protonradio.com/',
    sourceUrl: 'https://www.protonradio.com/',
    sourceType: 'automation_run_13_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'progressive house', 'trance', 'techno', 'deep house', 'dj-mixes'],
    submissionMethod: 'electronic-radio-label-and-dj-show-discovery-route-needs-current-intake-review',
    manualReviewRequired: true,
    manualReviewReason:
      'Proton is a relevant electronic radio, DJ show and label ecosystem, but the current authorized music submission or show-pitch route was not safely form-mapped and must be reviewed manually.',
    notes:
      'Research verified long-running electronic radio and Proton Music label relevance. No upload, show submission, protected form or contact harvesting was performed.'
  },
  {
    name: 'DI.FM Electronic Radio Channel Discovery Route',
    websiteUrl: 'https://www.di.fm/',
    submissionUrl: 'https://www.di.fm/submissions',
    sourceUrl: 'https://www.di.fm/submissions',
    sourceType: 'automation_run_351_public_reverification',
    country: 'United States / global electronic radio network with channel-director demo review',
    language: 'en',
    genres: [
      'electronic',
      'house',
      'trance',
      'techno',
      'drum-and-bass',
      'dubstep',
      'ambient',
      'chillstep',
      'dj-mixes',
      'radio-airplay',
      'email-request',
      'manual-review'
    ],
    submissionMethod: 'official-difm-new-music-demo-email-request-to-channel-directors',
    feeRequired: false,
    feeAmount:
      'No submission fee or mandatory payment is stated for the official new-music and demo request route. DI.FM listener subscriptions are separate from music submission.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'DI.FM accepts brief new-music and demo requests by email to a mailing list reviewed by multiple Channel Directors. The request must identify a DI.FM channel-matching genre and describe the intended submission, including track names or mix listings. Attachments are prohibited; media links are permitted, and actual media is sent only if a Channel Director replies with instructions. The Send Request destination is Cloudflare-protected and was not decoded. A human must choose the correct channel, prepare a concise rights-cleared request and approved links, distinguish a track/demo request from a regular-show proposal, and send manually. Waiting lists for regular shows are currently closed for Progressive, Techno, Tech House and Trance, but the page continues to accept new-music/demo requests.',
    notes:
      "Materially reverified and corrected on 2026-07-14 from DI.FM's official homepage, Help & Support page and Submissions page. The support page explicitly redirects new-music and channel requests to the submissions page. The submissions page authorizes brief email requests without attachments, allows media links, requires a channel-matching genre and description, and states that only suitable requests receive a response. The site currently lists active Trance, House, Techno, Chillstep, Ambient, Drum and Bass, Dubstep and other electronic channels and carries a 2026 copyright notice. The protected Send Request email was not decoded, guessed or stored. No email, attachment, media link, account, login, form, subscription or payment was used, and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed."
  },
  {
    name: 'Ninja Tune Electronic and Experimental Label Route',
    websiteUrl: 'https://ninjatune.net/',
    submissionUrl: 'https://ninjatune.net/',
    sourceUrl: 'https://ninjatune.net/',
    sourceType: 'automation_run_13_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['electronic', 'downtempo', 'experimental', 'dance', 'hip-hop', 'bass'],
    submissionMethod: 'electronic-label-route-needs-current-demo-policy-and-contact-review',
    manualReviewRequired: true,
    manualReviewReason:
      'Ninja Tune is a relevant electronic/downtempo/experimental label route, but no safe current public demo form or submission policy was mapped in this run. Current demo policy, A&R routing and rights expectations require manual review.',
    notes:
      'Research verified label activity and electronic relevance. No business email was guessed, no contact pattern was generated and no protected flow was accessed.'
  }
];
