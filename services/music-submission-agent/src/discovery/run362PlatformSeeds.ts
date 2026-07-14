import type { PlatformInput } from '../models/types.js';

export const run362SeedPlatforms: PlatformInput[] = [
  {
    name: '4ZZZ 102.1FM First-Party Digital Music Submission Form',
    websiteUrl: 'https://4zzz.org.au/',
    submissionUrl: 'https://jeff.4zzz.org.au/form/submit-your-music-to-4zzz',
    sourceUrl: 'https://4zzz.org.au/music-submissions',
    sourceType: 'automation_run_362_public_research',
    country: 'Australia / Brisbane, Queensland / independent community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'experimental',
      'ambient',
      'dub',
      'reggae',
      'world-music',
      'hip-hop',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'submission-form',
      'manual-review'
    ],
    submissionMethod: 'official-4zzz-javascript-dependent-downloadable-audio-submission-form',
    feeRequired: false,
    feeAmount: 'No submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      '4ZZZ authorizes submissions through its first-party JavaScript-dependent form. The form requires a contact email, artist and release details, genre, biography or press-pack information, content-warning information, a downloadable WAV or 320-kbps MP3 link, cover-art link, social links and an airplay-permission acknowledgement. Spotify-only links are rejected, and Bandcamp or Apple Music routes require a download code. A human must verify international eligibility, current form controls, privacy and rights wording, release suitability, downloadable permissions and whether any live CAPTCHA or validation step appears before submitting. Do not automate the form or bypass JavaScript, validation or anti-bot controls.',
    notes:
      'Verified on 2026-07-14 from 4ZZZ official Music Submissions, first-party submission-form and homepage pages. The form is hosted on the station-controlled jeff.4zzz.org.au subdomain and explicitly states that JavaScript is required. Current activity was confirmed through July 2026 on-air data, Album of the Week, events and station updates. No email address was inferred, no form field was completed and no CAPTCHA, login, payment, file upload or anti-bot control was bypassed.'
  },
  {
    name: 'RTRFM 92.1 First-Party Overseas Music Submission Form',
    websiteUrl: 'https://rtrfm.com.au/',
    submissionUrl: 'https://rtrfm.com.au/submit-your-music/',
    sourceUrl: 'https://rtrfm.com.au/submit-your-music/',
    sourceType: 'automation_run_362_public_research',
    country: 'Australia / Perth, Western Australia / independent community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'dance',
      'ambient',
      'experimental',
      'global',
      'world-music',
      'hip-hop',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'submission-form',
      'international-submission',
      'manual-review'
    ],
    submissionMethod: 'official-rtrfm-form-with-overseas-option-free-download-link-and-honeypot',
    feeRequired: false,
    feeAmount:
      'The digital submission route is free. Optional physical-copy production, international postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'RTRFM explicitly offers an Overseas option in its first-party form. The route requests personal contact details, city and state/region, artist name, optional biography upload, social links, upcoming gigs, a stream link and a music download link that must be free to download. The page prefers WAV or high-quality MP3 and asks artists to submit about two weeks before release. A honeypot-style Comments field is marked for validation and must be left unchanged. A human must review privacy, data-minimization, rights, file-link permissions, release timing, genre fit and any live CAPTCHA or validation state. Do not populate the honeypot or automate submission. Protected email destinations on the page were not decoded or used as a workaround.',
    notes:
      'Verified on 2026-07-14 from RTRFM official Submit Your Music and homepage pages. The form explicitly lists Overseas, identifies Music Director Matt Perrett, accepts free downloadable links and displays a leave-unchanged validation field. Current activity was confirmed through active programming, RTR2, featured music and official stories dated 2026-07-14. The protected contact addresses were not decoded, inferred or guessed. No form, file, email, package, login, CAPTCHA or payment action was performed.'
  }
];
