import type { PlatformInput } from '../models/types.js';

export const run313SeedPlatforms: PlatformInput[] = [
  {
    name: 'KEXP Digital Music Submission',
    websiteUrl: 'https://www.kexp.org/',
    submissionUrl: 'https://www.kexp.org/about/submission-guidelines/',
    sourceUrl: 'https://www.kexp.org/about/submission-guidelines/',
    sourceType: 'automation_run_313_public_research',
    country: 'United States / Seattle and Bay Area station with a global online audience',
    language: 'en',
    genres: [
      'all-genres',
      'eclectic',
      'indie',
      'electronic',
      'ambient',
      'hip-hop',
      'world',
      'latin',
      'punk',
      'roots',
      'radio-airplay',
      'public-business-email',
      'manual-review'
    ],
    submissionMethod: 'official-public-music-director-email-with-streaming-and-wav-download-links',
    feeRequired: false,
    feeAmount: 'No submission fee is stated. KEXP explicitly says artists cannot pay for airplay.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'A human must select the appropriate MarcsMusic release and focus track, confirm streaming and WAV-download permissions, prepare the requested metadata, credits, lyric sheet, biography and clean edit where applicable, and send one concise submission without attachments. Individual DJ contacts must not be mass-mailed or used as a substitute for the Music Department route.',
    notes: 'Verified on 2026-07-12 from KEXP first-party Submission Guidelines and Contact pages. KEXP publicly directs digital airplay submissions to md@kexp.org and requests streaming plus WAV download links, artist name and pronouns, release title and label, phonetics where needed, focus tracks, release dates, clean edits for FCC issues, lyrics, credits, a biography or one-sheet and relevant Pacific Northwest or Bay Area show dates. The official page says not to send attachments or physical submissions, not to expect a response, and not to harass staff on social media. It also explicitly rejects pay-for-play. Current activity was confirmed through live programming, new-music reviews and July 2026 event listings on the official homepage. The address was verified as publicly displayed, same-domain and purpose-specific; no SMTP, MX, catch-all or mailbox-level deliverability probe was performed. No email, music link, file or metadata was sent.'
  },
  {
    name: 'KBOO Genre-Routed Physical Music Submission',
    websiteUrl: 'https://www.kboo.fm/',
    submissionUrl: 'https://www.kboo.fm/submit-your-music',
    sourceUrl: 'https://www.kboo.fm/submit-your-music',
    sourceType: 'automation_run_313_public_research',
    country: 'United States / Portland, Oregon community radio',
    language: 'en',
    genres: [
      'electronic',
      'world',
      'reggae',
      'rock',
      'punk',
      'hip-hop',
      'folk',
      'jazz',
      'community-radio',
      'physical-submission',
      'manual-review'
    ],
    submissionMethod: 'official-genre-routed-physical-mail-submission',
    feeRequired: false,
    feeAmount: 'No submission fee is stated; the sender is responsible for preparing and mailing the physical package.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'KBOO currently accepts general music submissions by physical mail because it says it lacks a digital library and volunteer capacity to download and burn digital submissions. A human must choose the correct genre addressee, confirm that MarcsMusic fits the selected program or contact, approve physical media and packaging, understand that submitted materials become KBOO property and will not be returned, and authorize postage. No package may be prepared or mailed automatically.',
    notes: 'Verified on 2026-07-12 from KBOO first-party Submit Your Music page. The official route is physical delivery to KBOO-FM, 20 SE 8th Ave, Portland, OR 97214, with named addressees by genre: Keith Bloom for electronic and other genres; Diane Karl for folk; Brandon Lieberman for rock, punk, electronic and other genres; Rita Rega for jazz; Brendon Reyes for hip-hop; and Charlie Rooney for world music and reggae. The page also permits routing to a matching program from the official directory. KBOO states that submissions become station property, are not returned, may be passed on, and carry no guarantee of airplay. The station website remains operational with live/on-air programming, a 2026 schedule and recent 2026 playlists and audio. No public digital submission form or music-submission email was identified for this route. No package, disc, letter, payment or shipment was prepared or sent.'
  }
];
