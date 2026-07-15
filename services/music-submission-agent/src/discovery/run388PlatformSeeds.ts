import type { PlatformInput } from '../models/types.js';

export const run388SeedPlatforms: PlatformInput[] = [
  {
    name: '4ZZZ Music Department Online Airplay Submission Form',
    websiteUrl: 'https://4zzz.org.au/',
    submissionUrl: 'https://jeff.4zzz.org.au/form/submit-your-music-to-4zzz',
    sourceUrl: 'https://4zzz.org.au/music-submissions',
    sourceType: 'automation_run_388_public_research',
    country: 'Australia / Brisbane independent community radio',
    language: 'en',
    genres: [
      'community-radio',
      'independent-music',
      'new-music',
      'electronic',
      'dance',
      'hip-hop',
      'beats',
      'experimental',
      'world-music',
      'downloadable-audio-link',
      'javascript-form',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-javascript-dependent-downloadable-audio-airplay-submission-form',
    feeRequired: false,
    feeAmount: 'No submission fee is stated on the official Music Submissions page or canonical form.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      '4ZZZ explicitly authorizes music submissions through its canonical first-party form, but the form requires JavaScript and a final airplay-permission acknowledgement. A human must re-open the form, confirm that no CAPTCHA, session, consent or validation boundary has appeared, choose the correct MarcsMusic release, verify international eligibility, provide a downloadable WAV or 320 kbps MP3 link rather than Spotify, verify download permissions and metadata, review the optional identity fields and privacy implications, disclose any language or content warning, check the AI-origin policy and submit only after final rights and consent approval. The published music-department@4zzz.org.au mailbox is for following up an existing submission and must not replace the form for an initial pitch.',
    notes:
      'Verified on 2026-07-15 from 4ZZZ’s official Music Submissions, canonical submission-form, Contact, schedule, reviews and events pages. The station expressly invites airplay submissions through the form and requires a downloadable release link. Accepted audio is WAV or MP3 at 320 kbps; public or private downloadable SoundCloud and cloud-storage links are examples, Spotify links are rejected, and Bandcamp or Apple Music submissions require a download code. The form requests artist and release details, release date, pre-release permission, genre, label or distributor, member names and pronouns, optional identity information, biography or press-pack information, content warnings, cover-art and social links, Brisbane-area show information and a final permission acknowledgement. No login, payment or textual CAPTCHA requirement was observed in the passive first-party representation, but JavaScript is mandatory. The follow-up mailbox music-department@4zzz.org.au is published on the official Contact page with valid syntax and exact official-domain alignment but is not classified as the initial delivery route. No form field, email, audio asset, download code, personal information, permission checkbox or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  }
];
