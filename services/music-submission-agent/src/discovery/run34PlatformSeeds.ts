import type { PlatformInput } from '../models/types.js';

export const run34SeedPlatforms: PlatformInput[] = [
  {
    name: 'Radio Free Brooklyn Music Submission Form',
    websiteUrl: 'https://radiofreebrooklyn.com/',
    submissionUrl: 'https://radiofreebrooklyn.com/music-submission-form/',
    sourceUrl: 'https://radiofreebrooklyn.com/music-submission-form/',
    sourceType: 'automation_run_34_public_research',
    country: 'United States / Brooklyn New York / independent community internet radio and global streaming audience',
    language: 'en',
    genres: [
      'electronic',
      'indie',
      'hip-hop',
      'reggae',
      'dub',
      'world',
      'experimental',
      'community-radio',
      'internet-radio',
      'radio-airplay'
    ],
    submissionMethod: 'public-music-submission-form-with-free-download-link-and-physical-media-option',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official form requires artist/contact metadata, track URLs, NYC-area availability questions and a validation/CAPTCHA-style challenge; the route must be reviewed manually and no anti-spam control may be automated.',
    notes:
      'Official public form requires freely downloadable music links and says music that cannot be listened to or downloaded for free will not be considered. Site activity verified through 2026 posts and current LocalChords/music navigation. No form was submitted and no CAPTCHA/validation field was bypassed.'
  },
  {
    name: 'Worldwide FM Collaboration and New Voices Pitch Route',
    websiteUrl: 'https://worldwidefm.net/',
    submissionUrl: 'https://worldwidefm.net/contact',
    sourceUrl: 'https://worldwidefm.net/contact',
    sourceType: 'automation_run_34_public_research',
    country: 'United Kingdom / London / global online radio platform and international curator network',
    language: 'en',
    genres: [
      'electronic',
      'dub',
      'reggae',
      'jazz',
      'hip-hop',
      'world',
      'latin',
      'soul',
      'global-club',
      'radio-pitch',
      'curator-pitch'
    ],
    submissionMethod: 'public-contact-form-and-business-email-for-collaboration-or-editorial-pitch',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The official route is a general contact/collaboration form and public business email, not a complete track-upload submission form; pitch fit, rights, clean links, curator relevance and outreach copy require owner approval.',
    notes:
      'Official site verified current global radio activity, 2026 New Voices programming and a public info@worldwidefm.net contact route. No message was sent, no login was used and no SMTP/MX probing was performed in this repo update.'
  },
  {
    name: 'NTS Radio Show Proposal Audio-Link Route',
    websiteUrl: 'https://www.nts.live/',
    submissionUrl: 'https://www.nts.live/contact',
    sourceUrl: 'https://www.nts.live/contact',
    sourceType: 'automation_run_34_public_research',
    country: 'United Kingdom / London and Manchester / global underground online radio audience',
    language: 'en',
    genres: [
      'electronic',
      'bass',
      'dub',
      'reggae',
      'experimental',
      'club',
      'hip-hop',
      'global-underground',
      'radio-show-proposal',
      'mix-submission'
    ],
    submissionMethod: 'public-radio-show-proposal-form-with-external-audio-demo-links',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'NTS exposes a public radio-show proposal form that accepts audio demo links, but it is an editorial show-pitch route rather than a direct track-submission queue; concept, audio links, rights and suitability must be manually reviewed.',
    notes:
      'Official contact form asks for a proposal, show type and up to three SoundCloud, Mixcloud or YouTube audio links. No form was submitted and no account, payment or platform control was used.'
  },
  {
    name: 'WMSC 90.3 FM Music Director Review Route',
    websiteUrl: 'https://wmscradio.com/',
    submissionUrl: 'https://wmscradio.com/management/',
    sourceUrl: 'https://wmscradio.com/management/',
    sourceType: 'automation_run_34_public_research',
    country: 'United States / Montclair New Jersey / college radio, online stream and local music audience',
    language: 'en',
    genres: [
      'indie',
      'alternative',
      'electronic',
      'hip-hop',
      'local-music',
      'live-session',
      'college-radio',
      'radio-airplay',
      'artist-interview'
    ],
    submissionMethod: 'public-music-director-team-email-link-and-station-contact-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The official management page exposes Music Director and Assistant Music/Web Director roles with an email-team link, but the underlying protected email link was not decoded and any music pitch must be manually prepared and approved.',
    notes:
      'Official WMSC pages verified recent 2026 music coverage, active station programming, Best Student Media Website recognition and public Music Director routing. No protected contact was decoded, no email was sent and no SMTP/MX probing was performed.'
  },
  {
    name: 'WFUV 90.7 Music Department Physical Submission Route',
    websiteUrl: 'https://wfuv.org/',
    submissionUrl: 'https://wfuv.org/contactus',
    sourceUrl: 'https://wfuv.org/contactus',
    sourceType: 'automation_run_34_public_research',
    country: 'United States / New York City / public radio, AAA music discovery and global web audience',
    language: 'en',
    genres: [
      'adult-album-alternative',
      'indie',
      'singer-songwriter',
      'world',
      'electronic',
      'roots',
      'alternative',
      'public-radio',
      'radio-airplay',
      'music-discovery'
    ],
    submissionMethod: 'official-physical-music-department-mail-route-with-department-follow-up-window',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WFUV publishes a physical send-music route to the Music Department and a limited follow-up call window; physical media decisions, packaging, rights, clean/radio-safe assets and any staff follow-up must remain manual.',
    notes:
      'Official WFUV site verified active 2026 music discovery programming, live sessions and a public Contact & Staff page that says to send music by snail mail to the Music Department. No physical mail, email, upload or phone action was attempted.'
  }
];
