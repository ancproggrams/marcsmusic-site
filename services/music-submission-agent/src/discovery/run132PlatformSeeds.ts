import type { PlatformInput } from '../models/types.js';
import { run133SeedPlatforms } from './run133PlatformSeeds.js';

const run132BaseSeedPlatforms: PlatformInput[] = [
  {
    name: "KXCI Global Digital and Physical Music Department Submission Route",
    websiteUrl: "https://kxci.org/",
    submissionUrl: "https://kxci.org/about/music-department/",
    sourceUrl: "https://kxci.org/about/music-department/",
    sourceType: "automation_run_132_public_research",
    country: "United States / Tucson community radio with worldwide music-submission acceptance and Arizona priority",
    language: "en",
    genres: ["kxci", "community-radio", "global-submissions", "electronic", "world", "reggae", "indie", "mp3", "wav", "cd", "vinyl", "manual-review"],
    submissionMethod: "official-kxci-global-digital-physical-music-department-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because KXCI asks for MP3/WAV download links or physical CDs/vinyl, full release metadata, explicit-language notes, artwork, tracklist, bio, social links and contact details before staff/volunteer airplay review.",
    notes: "Official public research confirmed KXCI accepts and broadcasts music from all over the world, accepts CDs, vinyl with digital download, and MP3/WAV download links, and publishes Music Department and staff contact routes. No email was sent, no download link was delivered, no physical mail was prepared and no contact form was submitted."
  },
  {
    name: "KRCL Physical Music Department and Utah Digital Upload Route",
    websiteUrl: "https://krcl.org/",
    submissionUrl: "https://krcl.org/about/how-to-submit-music/",
    sourceUrl: "https://krcl.org/about/how-to-submit-music/",
    sourceType: "automation_run_132_public_research",
    country: "United States / Salt Lake City listener-community radio with physical music route and Utah digital upload form",
    language: "en",
    genres: ["krcl", "community-radio", "physical-cd", "google-form", "utah-local", "airplay-review", "no-demos", "no-cd-r", "manual-review"],
    submissionMethod: "official-krcl-physical-music-department-utah-digital-upload-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because KRCL separates physical CD submissions from a Utah-only digital Google Form route, excludes demos/CD-Rs, treats submitted media as station property, and does not guarantee airplay or response.",
    notes: "Official public research confirmed KRCL has an active How to Submit Music route, physical Music Department address, and a Google Forms digital-upload path for Utah musicians. No form was opened beyond public discovery, no account/session was used, no package was prepared, and no music was submitted."
  },
  {
    name: "Spinnin Records Talent Pool Account Demo Upload Route",
    websiteUrl: "https://spinninrecords.com/",
    submissionUrl: "https://spinninrecords.com/talentpool/",
    sourceUrl: "https://spinninrecords.com/talentpool/",
    sourceType: "automation_run_132_public_research",
    country: "Global / Netherlands dance-label talent pool and demo-upload community",
    language: "en",
    genres: ["spinnin-records", "talent-pool", "demo-upload", "dance", "edm", "house", "electronic", "account-required", "login-required", "manual-review"],
    submissionMethod: "official-spinnin-records-talent-pool-account-demo-upload-route",
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because Spinnin' Talent Pool requires account creation/login before demo upload, track selection, rights/metadata review, community/profile decisions and terms acceptance.",
    notes: "Official public research confirmed Spinnin' Talent Pool is active, exposes a Log in to submit your demo route, shows current Talent Pool tracks and latest additions, and requires an account before upload. No account was created, no login was used, no demo was uploaded and no terms were accepted."
  },
  {
    name: "WNCW Programming Department CD WAV MP3 Airplay Submission Route",
    websiteUrl: "https://www.wncw.org/",
    submissionUrl: "https://www.wncw.org/submit-music",
    sourceUrl: "https://www.wncw.org/submit-music",
    sourceType: "automation_run_132_public_research",
    country: "United States / North Carolina AAA, Americana, reggae, world, folk, blues and roots public radio",
    language: "en",
    genres: ["wncw", "public-radio", "aaa", "americana", "reggae", "world", "folk", "blues", "cd", "wav", "mp3", "download-link", "manual-review"],
    submissionMethod: "official-wncw-programming-department-cd-wav-mp3-airplay-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because WNCW prefers CD preview copies but also accepts WAV/MP3 files via a common download service, requests one-sheet context, and does not guarantee airplay, response, return, or follow-up.",
    notes: "Official public research confirmed WNCW's Submit Music page, physical Programming Department route, WAV/MP3 digital-file route through common download services, one-sheet guidance, single/EP/full-length acceptance and 2026 site activity. No email was sent, no link was delivered and no physical package was prepared."
  },
  {
    name: "Revealed Recordings Account Gated Electronic Demo Submission Route",
    websiteUrl: "https://www.revealedrecordings.com/",
    submissionUrl: "https://www.revealedrecordings.com/demo",
    sourceUrl: "https://www.revealedrecordings.com/",
    sourceType: "automation_run_132_public_research",
    country: "Global / Netherlands electronic dance label demo route for Revealed, Gemstone, Radar and related labels",
    language: "en",
    genres: ["revealed-recordings", "demo", "edm", "big-room", "progressive-house", "bass-house", "techno", "account-required", "spotify-login-option", "manual-review"],
    submissionMethod: "official-revealed-recordings-account-gated-electronic-demo-submission-route",
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because Revealed's Demo route redirects to account sign-in with email/password or Spotify connection, requiring owner-controlled login, demo upload/metadata, rights checks and label-fit decisions.",
    notes: "Official public research confirmed the Revealed site is active with current 2026 releases and a Demo navigation route that redirects to Sign in before demo submission. No account was created, no Spotify connection was authorized, no login was used and no demo was uploaded."
  }
];

export const run132SeedPlatforms: PlatformInput[] = [
  ...run132BaseSeedPlatforms,
  ...run133SeedPlatforms
];
