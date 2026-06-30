import type { PlatformInput } from '../models/types.js';

export const run23SeedPlatforms: PlatformInput[] = [
  {
    name: 'KEXP Airplay Consideration Digital Submission Route',
    websiteUrl: 'https://www.kexp.org/',
    submissionUrl: 'https://www.kexp.org/about/submission-guidelines/',
    sourceUrl: 'https://www.kexp.org/about/submission-guidelines/',
    sourceType: 'automation_run_23_public_research',
    country: 'United States / Seattle / global streaming audience',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'pop', 'hip-hop', 'indie', 'alternative'],
    submissionMethod: 'public-digital-email-route-to-music-director-needs-human-targeting-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official route is a public email submission to md@kexp.org; manual review is required for release package completeness, clean/FCC-safe edits, one-sheet quality, genre fit and non-spam follow-up cadence before outreach.',
    notes:
      'Official KEXP submission guidelines request streaming and WAV download links, metadata, focus tracks, release date, lyric sheet, credits, bio/one-sheet and Pacific Northwest/Bay Area show info. No email was sent and no physical submission was attempted.'
  },
  {
    name: 'KALX Berkeley Airplay Physical Music Submission Route',
    websiteUrl: 'https://kalx.berkeley.edu/',
    submissionUrl: 'https://kalx.berkeley.edu/about/contact/',
    sourceUrl: 'https://kalx.berkeley.edu/about/contact/',
    sourceType: 'automation_run_23_public_research',
    country: 'United States / Berkeley / San Francisco Bay Area',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'college-radio', 'alternative', 'independent'],
    submissionMethod: 'physical-cd-or-lp-mail-route-with-public-music-director-contact-needs-manual-postal-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KALX currently accepts only physical professionally pressed CDs or LPs for airplay; digital links/downloads are explicitly not accepted. Requires manual postal package decision and no automated submission.',
    notes:
      'Official KALX contact page lists music@kalx.berkeley.edu and says music for airplay must be mailed to Attn: Music Director; plain-text email only and no attachments. No email or postal action attempted.'
  },
  {
    name: 'WXPN Airplay and Local Show Music Submission Route',
    websiteUrl: 'https://xpn.org/',
    submissionUrl: 'https://xpn.org/contact/',
    sourceUrl: 'https://xpn.org/contact/',
    sourceType: 'automation_run_23_public_research',
    country: 'United States / Philadelphia / AAA public radio',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'aaa', 'indie', 'alternative', 'singer-songwriter'],
    submissionMethod: 'public-contact-page-mailto-route-needs-human-email-resolution-and-epk-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WXPN exposes Cloudflare-protected mailto links for Music Director and Local Show submission; email address extraction and any outreach require manual review. No automated scraping or email send attempted.',
    notes:
      'Official WXPN contact page requests EPK plus digitally downloadable music link for airplay, and WAV/high-quality MP3 download link plus short bio/upcoming shows for The Local Show.'
  },
  {
    name: 'KJHK 90.7 FM Electronic Music Submission Route',
    websiteUrl: 'https://kjhk.org/web/',
    submissionUrl: 'https://kjhk.org/web/submit-music/',
    sourceUrl: 'https://kjhk.org/web/submit-music/',
    sourceType: 'automation_run_23_public_research',
    country: 'United States / Lawrence Kansas / college radio',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'college-radio', 'local-music', 'alternative', 'independent'],
    submissionMethod: 'public-email-route-with-local-form-option-needs-link-package-review',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Electronic submissions are accepted by email links only, not file attachments; local-music route uses an external bit.ly form that may include anti-bot/manual fields. Review release package and form before any action.',
    notes:
      'Official KJHK page says albums are reviewed and voted on for rotation; electronic submissions should send information and music links to submitmusic@kjhk.org. No email or form submission attempted.'
  },
  {
    name: 'Spinnin Records Talent Pool Demo Submission Route',
    websiteUrl: 'https://spinninrecords.com/',
    submissionUrl: 'https://spinninrecords.com/talentpool/',
    sourceUrl: 'https://spinninrecords.com/talentpool/',
    sourceType: 'automation_run_23_public_research',
    country: 'Netherlands / global EDM label community',
    language: 'en',
    genres: ['edm', 'dance', 'house', 'tech-house', 'future-house', 'festival', 'electronic'],
    submissionMethod: 'authenticated-talent-pool-demo-submit-route-needs-login-and-rights-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Talent Pool requires account login before demo upload. Authentication, terms, SoundCloud/link ownership and label/demo eligibility must be reviewed manually. No account action attempted.',
    notes:
      'Official Spinnin Talent Pool page is active and says users must create an account and log in to submit a demo. No login, upload or protected-form action attempted.'
  },
  {
    name: 'International Songwriting Competition 2026 Online Entry Route',
    websiteUrl: 'https://www.songwritingcompetition.com/',
    submissionUrl: 'https://www.songwritingcompetition.com/rules',
    sourceUrl: 'https://www.songwritingcompetition.com/rules',
    sourceType: 'automation_run_23_public_research',
    country: 'Global / online songwriting competition',
    language: 'en',
    genres: ['electronic', 'edm', 'world', 'pop', 'hip-hop', 'instrumental', 'performance', 'unsigned', 'unpublished'],
    submissionMethod: 'paid-online-contest-entry-route-needs-payment-rights-ai-and-category-review',
    feeRequired: true,
    feeAmount: 'ISC 2026: $25 early bird, $30 regular, $35 extended per entry/category cycle',
    loginRequired: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason:
      'ISC requires paid entry fees and rights/originality declarations; AI-use disclosure and category eligibility must be reviewed before any entry. Payment and terms acceptance are blocked until owner approval.',
    notes:
      'Official rules say ISC is open regardless of nationality, accepts online MP3 upload or song links, lists 2026 deadlines/fees and states entrants retain ownership. No payment or entry action attempted.'
  }
];
