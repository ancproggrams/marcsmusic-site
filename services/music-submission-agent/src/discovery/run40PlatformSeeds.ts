import type { PlatformInput } from '../models/types.js';

export const run40SeedPlatforms: PlatformInput[] = [
  {
    name: 'KVRX 91.7 FM Austin Music Submissions',
    websiteUrl: 'https://kvrx.org/',
    submissionUrl: 'https://kvrx.org/app/contact/',
    sourceUrl: 'https://kvrx.org/app/contact/',
    sourceType: 'automation_run_40_public_research',
    country: 'United States / Austin freeform college and community radio',
    language: 'en',
    genres: [
      'electronic',
      'reggae',
      'dub',
      'world',
      'bass-music',
      'hip-hop',
      'indie',
      'freeform-radio',
      'college-radio'
    ],
    submissionMethod: 'official-public-music-department-email-route-physical-and-digital-submissions',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KVRX publishes an official public music-submission route and currently accepts both physical and digital submissions, but outbound outreach still requires owner approval, track/clean-edit selection, metadata, release context and review of the station policy that AI-assisted/generated music submissions are not considered.',
    notes:
      'Official KVRX contact page says to send all music submissions for airplay consideration to music@kvrx.org, lists operations@kvrx.org for other music-submission questions, and states that both physical and digital submissions are currently accepted. No email, form submission, upload, protected-contact decoding or physical mail was attempted.'
  },
  {
    name: 'WNYU 89.1 FM Music Director Submissions',
    websiteUrl: 'https://wnyu.org/',
    submissionUrl: 'https://wnyu.org/about',
    sourceUrl: 'https://wnyu.org/about',
    sourceType: 'automation_run_40_public_research',
    country: 'United States / New York City freeform college radio',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'reggae',
      'dub',
      'hip-hop',
      'indie',
      'experimental',
      'freeform-radio',
      'college-radio'
    ],
    submissionMethod: 'official-public-physical-and-digital-music-director-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WNYU publishes an official Send us music route with physical submissions prioritized and digital submissions accepted by the Music Director. Manual review is required for track fit, physical-vs-digital decision, rights/metadata checks, clean-edit review and pitch copy before any outbound contact.',
    notes:
      'Official WNYU about page says artists can send CDs, CD-Rs, LPs, 12-inches, 10-inches or 7-inches to the station address and can send digital submissions to music@wnyu.org, with physical submissions prioritized. No email, form submission, upload or physical mail was attempted.'
  },
  {
    name: 'KZSC Santa Cruz Station Music Directors',
    websiteUrl: 'https://kzsc.org/',
    submissionUrl: 'https://kzsc.org/contact/',
    sourceUrl: 'https://kzsc.org/contact/',
    sourceType: 'automation_run_40_public_research',
    country: 'United States / Santa Cruz genre-specialty college radio',
    language: 'en',
    genres: [
      'electronic',
      'rpm',
      'reggae',
      'dub',
      'international',
      'hip-hop',
      'jazz',
      'rock',
      'college-radio'
    ],
    submissionMethod: 'official-public-station-music-director-contact-page-protected-links-manual-only',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KZSC lists official station music directors by format, including RPM & Electronic and International, but the contact links are protected mailto links in the fetched page. Manual review is required to select the correct director/format route without decoding protected contacts or guessing addresses.',
    notes:
      'Official KZSC contact page shows Station Music Directors, genre roles, active KZSC contact/navigation and 2026 footer. Protected contact links were observed but not decoded. No email, message form, mailing-list form or protected-contact workflow was used.'
  },
  {
    name: 'WHPK 88.5 FM Chicago Music Director and Format Chief Routing',
    websiteUrl: 'https://whpk.org/',
    submissionUrl: 'https://whpk.org/contact/',
    sourceUrl: 'https://whpk.org/contact/',
    sourceType: 'automation_run_40_public_research',
    country: 'United States / Chicago freeform and specialty college radio',
    language: 'en',
    genres: [
      'electronic',
      'international',
      'rap',
      'jazz',
      'folk',
      'rock',
      'experimental',
      'freeform-radio',
      'college-radio'
    ],
    submissionMethod: 'official-public-contact-form-and-format-chief-routing-for-artists-and-labels',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WHPK says artists and labels wishing to have music played should contact the relevant format chief or music directors and explicitly says not to contact the station manager for music submissions. Manual review is required for format routing, message content, field completion and avoiding misuse of non-submission contacts.',
    notes:
      'Official WHPK contact page includes a public contact form, Music Director listing, format chiefs, and guidance for artists/labels; homepage shows active schedule/now-playing and electronic, international, rap, jazz, folk and rock formats. No contact form or email was submitted.'
  },
  {
    name: 'WNUR 89.3 FM Submit Your Sound',
    websiteUrl: 'https://wnur.org/',
    submissionUrl: 'https://wnur.org/contact-us/',
    sourceUrl: 'https://wnur.org/contact-us/',
    sourceType: 'automation_run_40_public_research',
    country: 'United States / Evanston and Chicago experimental college radio',
    language: 'en',
    genres: [
      'electronic',
      'experimental',
      'jazz',
      'freeform-radio',
      'underrepresented-music',
      'chicago-music',
      'radio-airplay',
      'college-radio'
    ],
    submissionMethod: 'official-public-submit-your-sound-google-form-and-digital-files-email-route',
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WNUR publishes an official Submit Your Sound route through an external Google Form and a digital-files email route. Manual review is required because external forms may impose Google/session controls and because the music package, rights, file links, genre fit and pitch context need owner approval.',
    notes:
      'Official WNUR contact page says artists can send music via a forms.gle link and email digital files to submissions.wnur@gmail.com. Official about page describes WNUR as a non-commercial, listener-supported station promoting underrepresented music and streaming worldwide. No Google Form, email, upload or login flow was used.'
  }
];