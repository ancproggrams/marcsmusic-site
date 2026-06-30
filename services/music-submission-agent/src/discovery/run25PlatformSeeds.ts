import type { PlatformInput } from '../models/types.js';

export const run25SeedPlatforms: PlatformInput[] = [
  {
    name: 'EARMILK SubmitHub and Pillargram Music Submission Route',
    websiteUrl: 'https://earmilk.com/',
    submissionUrl: 'https://earmilk.com/submit-music/',
    sourceUrl: 'https://earmilk.com/submit-music/',
    sourceType: 'automation_run_25_public_research',
    country: 'United States / Canada editorial network / global online publication',
    language: 'en',
    genres: ['electronic', 'dance', 'experimental', 'hip-hop', 'rnb', 'indie', 'pop', 'rock', 'music-video', 'premiere'],
    submissionMethod: 'public-submit-music-page-routes-to-submithub-or-pillargram-needs-freemium-platform-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official page says EARMILK exclusively accepts submissions through SubmitHub or Pillargram. These third-party routes can involve accounts, credits, campaign options, feedback terms or paid upgrades, so owner review is required before any action.',
    notes:
      'EARMILK shows current 2026 editorial activity across electronic, dance, experimental, hip-hop, indie, pop, rock and videos. Its contact page explicitly says music submissions through the general contact form are filtered; david@earmilk.com is listed only for business, brand partnership and event requests, not music submission.'
  },
  {
    name: 'Obscure Sound SubmitHub and MusoSoup Indie/Electronic Submission Route',
    websiteUrl: 'https://www.obscuresound.com/',
    submissionUrl: 'https://www.obscuresound.com/',
    sourceUrl: 'https://www.obscuresound.com/',
    sourceType: 'automation_run_25_public_research',
    country: 'United States / global online indie music publication',
    language: 'en',
    genres: ['electronic', 'idm', 'ambient', 'indie', 'dream-pop', 'folk', 'rock', 'pop', 'hip-hop', 'album-review'],
    submissionMethod: 'public-site-submission-links-to-submithub-or-musosoup-needs-freemium-platform-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The site routes music submissions through SubmitHub or MusoSoup. Both can require account login, terms acceptance, curator credits, campaign offers or paid package decisions, so this is queued for manual free-path review only.',
    notes:
      'Obscure Sound is active with June 2026 track and album coverage and explicitly links to SubmitHub and MusoSoup for music submissions. No platform login, campaign setup, credit spend, upload or message action was attempted.'
  },
  {
    name: 'Variance Magazine Editorial Pitch and Premiere Submission Route',
    websiteUrl: 'https://variancemagazine.com/',
    submissionUrl: 'https://variancemagazine.com/contact',
    sourceUrl: 'https://variancemagazine.com/contact',
    sourceType: 'automation_run_25_public_research',
    country: 'United States / global online music and culture publication',
    language: 'en',
    genres: ['electronic', 'dance', 'pop', 'rnb', 'hip-hop', 'indie', 'alternative', 'premiere', 'exclusive', 'festival'],
    submissionMethod: 'public-editorial-contact-route-with-spambot-protected-email-links-needs-manual-resolution',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Variance lists public editorial, pitch, premiere, exclusive, press release and business inquiry routes, but the email links are protected by JavaScript/spambot protection. Do not decode, scrape or bypass protection; route must be resolved manually from the public page.',
    notes:
      'Variance shows current 2026 editorial activity and a contact page for editorial/media inquiries, pitches, premieres and business inquiries. No protected email decoding, form submission or outbound email action was attempted.'
  },
  {
    name: 'Radio Milwaukee Music Submission Route',
    websiteUrl: 'https://radiomilwaukee.org/',
    submissionUrl: 'https://radiomilwaukee.org/music-submission',
    sourceUrl: 'https://radiomilwaukee.org/music-submission',
    sourceType: 'automation_run_25_public_research',
    country: 'United States / Milwaukee Wisconsin / public radio and online audience',
    language: 'en',
    genres: ['electronic', 'dance', 'rnb', 'hip-hop', 'reggae', 'world', 'indie', 'alternative', 'local-music', 'public-radio'],
    submissionMethod: 'public-music-submission-guidelines-route-with-audio-package-and-radio-edit-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route requires a properly prepared radio submission package including WAV-preferred audio, clean/radio edits, bio, lyrics, release context and links. Manual review is required before any audio/link package is sent or uploaded.',
    notes:
      'Official Radio Milwaukee guidelines say no physical media, uncompressed audio preferred, radio edits required, and submission does not guarantee airplay or individual feedback. No email, form submission or upload was attempted.'
  },
  {
    name: 'KCRW Airplay Consideration and Contact Route',
    websiteUrl: 'https://www.kcrw.com/',
    submissionUrl: 'https://www.kcrw.com/pages/contact',
    sourceUrl: 'https://www.kcrw.com/pages/contact',
    sourceType: 'automation_run_25_public_research',
    country: 'United States / Los Angeles California / public radio and global streaming audience',
    language: 'en',
    genres: ['electronic', 'dance', 'progressive', 'world', 'reggae', 'indie', 'alternative', 'eclectic', 'new-music', 'public-radio'],
    submissionMethod: 'public-contact-and-airplay-consideration-route-needs-human-program-targeting-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KCRW is a high-selectivity public radio/music outlet. Public sources indicate recordings can be sent for airplay consideration, but the current public contact page does not expose a simple auto-submit form in parsed content. Manual targeting and contact resolution are required.',
    notes:
      'KCRW contact page is active in 2026 and the station has music programming including eclectic, electronic/dance and new music shows. No contact extraction beyond public pages, email guessing, submission, upload or account action was attempted.'
  }
];
