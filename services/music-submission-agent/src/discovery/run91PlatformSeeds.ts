import type { PlatformInput } from '../models/types.js';
import { run92SeedPlatforms } from './run92PlatformSeeds.js';
import { run93SeedPlatforms } from './run93PlatformSeeds.js';
import { run94SeedPlatforms } from './run94PlatformSeeds.js';

const run91CoreSeedPlatforms: PlatformInput[] = [
  {
    name: "PBS 106.7FM Submit Your Music Form",
    websiteUrl: "https://www.pbsfm.org.au/",
    submissionUrl: "https://www.pbsfm.org.au/submitmusic",
    sourceUrl: "https://www.pbsfm.org.au/submitmusic",
    sourceType: "automation_run_91_public_research",
    country: "Australia / Melbourne specialist contemporary community radio",
    language: "en",
    genres: ["pbs-106-7fm", "melbourne", "community-radio", "specialist-music", "electronic", "dub", "reggae", "world", "experimental", "international", "digital-form", "physical-mail", "captcha", "free-first", "manual-review"],
    submissionMethod: "official-pbs-submit-your-music-form-and-physical-mail-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because PBS provides an official digital Submit Your Music form with required contact/location fields, stream and high-quality download-link fields, plus a CAPTCHA control. The route also supports physical CD/vinyl delivery. CAPTCHA interaction, link permission checks, metadata, country/location fields, press/bio copy, file-quality requirements and station/show fit must remain manual.",
    notes: "Public research confirmed PBS explicitly invites new music from local and international acts, prefers the official digital form, lists physical Music Department mailing and reception handover options, recommends 4-5 physical copies, and requires stream plus 320kbps AAC/MP3/WAV-equivalent download links. No form was submitted, no CAPTCHA was interacted with, no files or links were delivered, no physical mail was sent and no account was used."
  },
  {
    name: "2SER Submit Music for Airplay Consideration Form",
    websiteUrl: "https://www.2ser.com/",
    submissionUrl: "https://www.2ser.com/how-to-submit-music",
    sourceUrl: "https://www.2ser.com/how-to-submit-music",
    sourceType: "automation_run_91_public_research",
    country: "Australia / Sydney alternative community radio",
    language: "en",
    genres: ["2ser", "sydney", "community-radio", "alternative", "electronic", "indie", "world", "reggae", "airplay-consideration", "music-director", "public-form", "public-email", "free-first", "manual-review"],
    submissionMethod: "official-2ser-submit-music-form-and-music-director-email-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because 2SER exposes an official Submit Your Music airplay-consideration form and a Music Director email route. The form requests artist/contact details, location, release date, artist bio and social links, while the contact page asks for digital submission to submitmusic@2ser.com and says not to send physical copies unless requested. Form completion, email copy, metadata, download/stream choice, physical-copy avoidance and station fit require manual review.",
    notes: "Public research confirmed the official 2SER Contact page lists submitmusic@2ser.com for Music Director airplay consideration and states physical copies should not be sent unless requested. The How to Submit Music page exposes a public Submit Your Music form for airplay consideration. No form was submitted, no email was sent, no files or links were delivered and no physical mail was sent."
  },
  {
    name: "Triple R 102.7FM Submit Music Route",
    websiteUrl: "https://www.rrr.org.au/",
    submissionUrl: "https://www.rrr.org.au/get-involved/submit-music",
    sourceUrl: "https://www.rrr.org.au/get-involved/submit-music",
    sourceType: "automation_run_91_public_research",
    country: "Australia / Melbourne independent community radio",
    language: "en",
    genres: ["triple-r", "3rrr", "melbourne", "independent-radio", "community-radio", "electronic", "dance", "hip-hop", "reggae", "world", "soundscape", "public-email", "physical-mail", "free-first", "manual-review"],
    submissionMethod: "official-triple-r-submit-music-email-and-physical-mail-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because Triple R is not playlisted, presenters select tracks, and the official route allows direct presenter servicing or station-level servicing via music@rrr.org.au with stream and download links, plus physical CD/LP/cassette mailing. Presenter targeting, email copy, download-link permissions, 320kbps MP3/WAV compliance, no-large-email-attachment handling, bio/gig details and physical package prep require manual review.",
    notes: "Public research confirmed Triple R's official Submit Music page says the station is not playlisted, gives two authorized routes, lists music@rrr.org.au for station-level submissions, requests stream and high-quality download links, and gives a Triple R Music Department postal address for physical releases. The current site also showed 2026 programming, articles, videos and events. No email was sent, no files or links were delivered, no physical mail was sent and no account was used."
  },
  {
    name: "FBi Radio Music Submissions Route",
    websiteUrl: "https://www.fbi.radio/",
    submissionUrl: "https://www.fbi.radio/pages/music-submissions",
    sourceUrl: "https://www.fbi.radio/pages/music-submissions",
    sourceType: "automation_run_91_public_research",
    country: "Australia / Sydney emerging music community radio",
    language: "en",
    genres: ["fbi-radio", "sydney", "community-radio", "emerging-music", "electronic", "dance", "hip-hop", "producer", "dj", "independent", "public-email", "digital-only", "paid-promo-side-route", "free-first", "manual-review"],
    submissionMethod: "official-fbi-radio-digital-music-submission-email-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because FBi's official route is digital email submission to music@fbiradio.com with stream and high-quality download links, bio, press image/gig details and timing rules for weekly auditioning. The same page separates paid promotional campaigns, so free editorial/radio submission must stay separated from sponsorship or paid-promo routes. Email copy, metadata, Tuesday-midnight timing, link permissions, Sydney/Australian relevance and paid-route avoidance require manual review.",
    notes: "Public research confirmed FBi's official contact page lists Music Submissions at music@fbiradio.com, and the Music Submissions page says musicians, bands, producers and DJs should submit digitally to that address. It lists stream/download requirements, Wednesday auditioning, no CD submissions, premiere/interview/gig-guide routes and separate paid promotional campaign options. No email was sent, no paid route was activated, no files or links were delivered and no account was used."
  },
  {
    name: "4ZZZ Music Submissions Form",
    websiteUrl: "https://4zzz.org.au/",
    submissionUrl: "https://4zzz.org.au/music-submissions",
    sourceUrl: "https://4zzz.org.au/music-submissions",
    sourceType: "automation_run_91_public_research",
    country: "Australia / Brisbane independent community radio",
    language: "en",
    genres: ["4zzz", "brisbane", "community-radio", "independent-radio", "electronic", "eclectic", "local-music", "australian-music", "zed-digital", "digital-library", "external-form", "free-first", "manual-review"],
    submissionMethod: "official-4zzz-music-submissions-external-form-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because 4ZZZ routes music through an official Music Submissions page that sends users to an external form for Music Department processing and digital-library inclusion. The page stresses downloadable music, non-playlisted programmer discretion and Album of the Week eligibility. External form handling, any session controls, downloadability checks, metadata, local/Australian fit, album/EP vs single routing and station-library fit must remain manual.",
    notes: "Public research confirmed 4ZZZ's official site is active with 2026 Top 20, Album of the Week, schedule and community updates. The Music Submissions page says submissions go to the 4ZZZ Music Department for airplay consideration, possible digital-library inclusion for announcers, and require downloadable music; it links separate external submission and Album of the Week forms. No external form was opened beyond the public link, no form was submitted, no files or links were delivered and no account was used."
  }
];

export const run91SeedPlatforms: PlatformInput[] = [
  ...run91CoreSeedPlatforms,
  ...run92SeedPlatforms,
  ...run93SeedPlatforms,
  ...run94SeedPlatforms
];
