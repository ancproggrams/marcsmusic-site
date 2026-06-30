import type { PlatformInput } from '../models/types.js';

export const run24SeedPlatforms: PlatformInput[] = [
  {
    name: 'KUTX On-Air Rotation and Specialty Show Music Submission Route',
    websiteUrl: 'https://kutx.org/',
    submissionUrl: 'https://kutx.org/submit-your-music/',
    sourceUrl: 'https://kutx.org/submit-your-music/',
    sourceType: 'automation_run_24_public_research',
    country: 'United States / Austin Texas / global streaming audience',
    language: 'en',
    genres: ['electronic', 'experimental', 'dance', 'reggae', 'world', 'latin', 'hip-hop', 'rnb', 'indie', 'alternative', 'texas'],
    submissionMethod: 'public-email-route-to-music-director-with-wav-link-and-clean-radio-edit-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official route is public email to music@kutx.org. Manual review is required for clean/FCC-safe edits, WAV download permissions, release package quality, specialty-show targeting and non-spam outreach cadence before sending.',
    notes:
      'Official KUTX guidelines request a subject line with artist/release/FFO/genre/location/date, streaming link, WAV download link, bio/location/release notes, tour info and a top-pick highlight. No email was sent and no form was submitted.'
  },
  {
    name: 'KVRX 91.7 FM Austin Music Submission Route',
    websiteUrl: 'https://kvrx.org/',
    submissionUrl: 'https://kvrx.org/contact/',
    sourceUrl: 'https://kvrx.org/contact/',
    sourceType: 'automation_run_24_public_research',
    country: 'United States / Austin Texas / college radio',
    language: 'en',
    genres: ['electronic', 'experimental', 'dance', 'reggae', 'world', 'hip-hop', 'indie', 'alternative', 'college-radio', 'local-music'],
    submissionMethod: 'public-music-department-email-route-with-ai-policy-and-digital-physical-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KVRX lists a public music submission email but states AI-assisted/generated music submissions will not be considered. Manual originality/AI-use review and release-fit review are required before any outreach.',
    notes:
      'Official KVRX contact page says music submissions for airplay consideration go to music@kvrx.org and that the station is taking both physical and digital submissions. No email or postal action attempted.'
  },
  {
    name: 'KZSC Santa Cruz Music Director Submission Route',
    websiteUrl: 'https://kzsc.org/',
    submissionUrl: 'https://kzsc.org/contact/',
    sourceUrl: 'https://kzsc.org/contact/',
    sourceType: 'automation_run_24_public_research',
    country: 'United States / Santa Cruz California / college radio',
    language: 'en',
    genres: ['electronic', 'rpm', 'experimental', 'reggae', 'world', 'international', 'hip-hop', 'indie', 'alternative', 'college-radio'],
    submissionMethod: 'public-music-director-contact-page-and-station-form-with-protected-mailto-needs-manual-resolution',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official contact page exposes music director roles and a station contact form, but mailto links are protected/redacted and the form contains validation/anti-spam fields. Do not scrape, decode or submit automatically.',
    notes:
      'KZSC lists Music/Rock, RPM & Electronic, International and other music director routes plus a contact form with a Music Submission option. No email extraction, anti-spam bypass or form submission attempted.'
  },
  {
    name: 'WERS Wicked Local Wednesday Music Submission Form Route',
    websiteUrl: 'https://wers.org/',
    submissionUrl: 'https://wers.org/submit-music/',
    sourceUrl: 'https://wers.org/submit-music/',
    sourceType: 'automation_run_24_public_research',
    country: 'United States / Boston Massachusetts / local public radio',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'pop', 'indie', 'alternative', 'local-music', 'college-radio'],
    submissionMethod: 'public-local-music-form-with-mp3-upload-and-recaptcha-needs-manual-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route is a public form for local Boston/New England artists, includes MP3 upload fields and the site is protected by reCAPTCHA. Local eligibility, file-upload consent and anti-bot protections require manual review.',
    notes:
      'Official WERS Submit Music page invites local bands to fill out the form for Wicked Local Wednesday and includes artist, track, email, location, genre, social links and MP3 upload fields. No upload or form submission attempted.'
  },
  {
    name: 'Triple R 102.7FM Melbourne Submit Music Route',
    websiteUrl: 'https://www.rrr.org.au/',
    submissionUrl: 'https://www.rrr.org.au/get-involved/submit-music',
    sourceUrl: 'https://www.rrr.org.au/get-involved/submit-music',
    sourceType: 'automation_run_24_public_research',
    country: 'Australia / Melbourne / independent radio',
    language: 'en',
    genres: ['electronic', 'dance', 'dub', 'reggae', 'world', 'hip-hop', 'indie', 'alternative', 'experimental', 'community-radio'],
    submissionMethod: 'public-email-and-physical-service-route-to-station-or-programs-needs-human-targeting-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Triple R is not playlisted and presenters select tracks individually. Manual targeting is required to choose relevant programs, prepare clean streaming/download links and avoid indiscriminate bulk email.',
    notes:
      'Official Triple R page accepts direct presenter servicing or station servicing via music@rrr.org.au with streaming/download links, high-quality MP3/WAV, bio, gig details and no large email attachments. No email or postal action attempted.'
  },
  {
    name: 'CKUA Radio Network Getting Airplay Digital Submission Route',
    websiteUrl: 'https://ckua.com/',
    submissionUrl: 'https://ckua.com/our-story/library/getting-airplay/',
    sourceUrl: 'https://ckua.com/our-story/library/getting-airplay/',
    sourceType: 'automation_run_24_public_research',
    country: 'Canada / Alberta / radio network',
    language: 'en',
    genres: ['electronic', 'experimental-pop', 'dance', 'reggae', 'world', 'soca', 'folk', 'roots', 'country', 'indie', 'canadian'],
    submissionMethod: 'public-digital-submission-route-via-send-it-now-and-music-committee-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CKUA currently asks for digital submissions only and reviews music via its Music Committee. Manual review is required for clean/radio edits, Canadian/Alberta fit, download-link permissions and host targeting.',
    notes:
      'Official CKUA guidelines request one-sheet/backgrounder/bio/website links, streaming and download links, 320kbps MP3 where possible, no zip files or large attachments, and clean/radio-safe content. No email or postal action attempted.'
  },
  {
    name: 'CJSW 90.9 FM Calgary Digital Music Submission Route',
    websiteUrl: 'https://cjsw.com/',
    submissionUrl: 'https://cjsw.com/music/submit/',
    sourceUrl: 'https://cjsw.com/music/submit/',
    sourceType: 'automation_run_24_public_research',
    country: 'Canada / Calgary Alberta / campus and community radio',
    language: 'en',
    genres: ['electronic', 'experimental', 'dance', 'reggae', 'world', 'hip-hop', 'rnb', 'indie', 'alternative', 'campus-radio'],
    submissionMethod: 'external-jotform-digital-album-upload-route-needs-release-format-and-form-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CJSW uses an external Jotform upload route and only accepts digital album releases from the last three months with three or more unique tracks. Form terms, file packaging and release eligibility require manual review.',
    notes:
      'Official CJSW page says digital music submissions only, no singles, MP3 format, album in zip format, and provides a Jotform upload button plus a public contact for assistance. No form upload or contact action attempted.'
  }
];
