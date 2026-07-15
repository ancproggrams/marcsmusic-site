import type { PlatformInput } from '../models/types.js';

export const run369SeedPlatforms: PlatformInput[] = [
  {
    name: '95bFM Lossless Download-Link Music Submission Route',
    websiteUrl: 'https://95bfm.com/',
    submissionUrl: 'https://95bfm.com/news/how-do-you-do-submitting-music',
    sourceUrl: 'https://95bfm.com/news/how-do-you-do-submitting-music',
    sourceType: 'automation_run_369_public_research',
    country: 'New Zealand / Auckland / independent student and community radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'dub',
      'reggae',
      'hip-hop',
      'house',
      'jungle',
      'funk',
      'soul',
      'global-music',
      'student-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-95bfm-protected-music-submission-email-action-with-stream-and-lossless-download',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      '95bFM requires both a streaming link and a directly accessible lossless download link, supports WAV and FLAC, rejects Spotify-only and account- or password-gated delivery, and asks for artist and song names, release timing and artist origin. The official Music Submissions destination is protected in passive rendering and was not decoded, inferred or stored. International eligibility is not explicit, and tracks older than one month are no longer eligible for A/B high-rotation playlisting. A human must select a suitable current release, prepare stable public stream and lossless-download links, open the official first-party email action manually and stop if a CAPTCHA, login, payment or new restriction appears.',
    notes:
      'Verified on 2026-07-15 from 95bFM official Submit Music, Staff Directory, Shows, homepage and 2026 relocation announcement pages. The submission route is purpose-bound and repeated on first-party pages, but the destination is Cloudflare-protected and was not decoded or guessed. Current operation was confirmed through live now-playing and schedule data, a relocation announcement specifying July 31, 2026, and active electronic, dub, hip-hop, house, experimental and global-music programming. The adjacent general contact form was excluded. No SMTP, MX, catch-all or mailbox-level probe was performed. No email, form, stream, download link, file, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'Radio One 91FM Digital Download-Link and Physical Music Submission Route',
    websiteUrl: 'https://www.r1.co.nz/',
    submissionUrl: 'https://www.r1.co.nz/contact',
    sourceUrl: 'https://www.r1.co.nz/contact',
    sourceType: 'automation_run_369_public_research',
    country: 'New Zealand / Dunedin / university student and alternative radio',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'techno',
      'drum-and-bass',
      'grime',
      'ambient',
      'reggae',
      'roots',
      'afrohouse',
      'funk',
      'soul',
      'hip-hop',
      'jazz',
      'global-music',
      'student-radio',
      'campus-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-radio-one-music-director-email-download-link-or-physical-mail',
    feeRequired: false,
    feeAmount:
      'No editorial submission fee or mandatory payment is stated. Physical-media production, postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Radio One publishes music@r1.co.nz for music submissions and a physical postal route. Its currently linked alternative-radio airplay guide asks for a downloadable track at minimum 320-kbps MP3 quality, correct file naming and tagging, artist origin and contact details, focus songs and desired timing, plus a one-page information sheet with website and social links. The guide uses a NZ Artist subject-line example and does not expressly confirm international eligibility, so MarcsMusic must not be submitted automatically. A human must confirm eligibility, select a suitable release, prepare the download and metadata, send manually through the Music Director route or prepare the physical package, and stop if a CAPTCHA, login, payment or new restriction appears.',
    notes:
      'Verified on 2026-07-15 from Radio One official Contact, About, Programme, Blog and homepage pages plus the alternative-radio airplay guide linked directly from the current Contact page. The Contact page names Maddy Barnes as Music Director and repeatedly publishes music@r1.co.nz for that role and Music Submissions; verification covered first-party publication, valid syntax, official-domain alignment and explicit business purpose. Current operation was confirmed through live now-playing data, a May 2026 programme, 2026 editorial posts and explicit programming in techno, drum-and-bass, grime, ambient, reggae, electronica, Afrohouse, roots and global music. No SMTP, MX, catch-all or mailbox-level probe was performed. No email, download link, one-sheet, physical package, login, CAPTCHA or payment was submitted.'
  }
];
