import type { PlatformInput } from '../models/types.js';
import { run134SeedPlatforms } from './run134PlatformSeeds.js';

const run133BaseSeedPlatforms: PlatformInput[] = [
  {
    name: "WMSE Music Department Physical Digital Cassette Airplay Submission Route",
    websiteUrl: "https://wmse.org/",
    submissionUrl: "https://wmse.org/about-wmse-radio/music-department/",
    sourceUrl: "https://wmse.org/about-wmse-radio/music-department/",
    sourceType: "automation_run_133_public_research",
    country: "United States / Milwaukee listener-supported eclectic community radio with physical and digital music-submission route",
    language: "en",
    genres: ["wmse", "community-radio", "eclectic", "independent", "cd", "vinyl", "cassette", "digital-download", "we-transfer", "fcc-clean", "manual-review"],
    submissionMethod: "official-wmse-music-department-physical-digital-cassette-airplay-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because WMSE accepts physical and digital music, asks for FCC-clean/airable-track disclosure, and leaves playlist decisions to volunteer hosts; package, tracklist, contact copy and link delivery must stay owner-controlled.",
    notes: "Official public research confirmed WMSE's active 2026 site, Music Director/business contacts, and a Music Department route accepting CD, vinyl, cassette and digital download via WeTransfer/email. No email, form, upload, link delivery or physical mail was sent."
  },
  {
    name: "WTJU Genre Music Director Digital Physical Library Submission Route",
    websiteUrl: "https://www.wtju.net/",
    submissionUrl: "https://www.wtju.net/submit-music/",
    sourceUrl: "https://www.wtju.net/submit-music/",
    sourceType: "automation_run_133_public_research",
    country: "United States / Charlottesville university-community radio with genre music-director routing",
    language: "en",
    genres: ["wtju", "college-radio", "community-radio", "eclectic", "classical", "jazz", "blues", "rock", "r-and-b", "hip-hop", "folk", "world", "mp3", "wav", "flac", "physical", "manual-review"],
    submissionMethod: "official-wtju-genre-music-director-digital-physical-library-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because WTJU routes music by genre department, accepts physical and digital files, treats streaming links as review-only, and requires correct Music Director targeting before any outreach or file/link delivery.",
    notes: "Official public research confirmed WTJU's active 2026 site and Submit Music page with USPS/UPS route, genre contacts, and accepted formats including CDs, LPs, 45s, MP3, WAV and FLAC. No email, form, upload, link delivery or physical mail was sent."
  },
  {
    name: "Radio Free Brooklyn reCAPTCHA Music Submission Form and Physical Route",
    websiteUrl: "https://www.radiofreebrooklyn.org/",
    submissionUrl: "https://submissions.radiofreebrooklyn.org/music-submission-form/",
    sourceUrl: "https://submissions.radiofreebrooklyn.org/music-submission-form/",
    sourceType: "automation_run_133_public_research",
    country: "United States / Brooklyn free-form internet radio with music form and local artist route",
    language: "en",
    genres: ["radio-free-brooklyn", "freeform-radio", "internet-radio", "independent", "local-artist", "download-link", "bandcamp", "soundcloud", "dropbox", "google-drive", "recaptcha", "manual-review"],
    submissionMethod: "official-radio-free-brooklyn-recaptcha-music-submission-form-physical-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because the official form requires artist/contact fields, downloadable track or ZIP URL, optional guest/on-air choices, image-size constraints and visible reCAPTCHA validation.",
    notes: "Official public research confirmed Radio Free Brooklyn's active 2026 site, public Submit Music navigation, official music submission form, downloadable-link requirement, physical CD/vinyl alternative and reCAPTCHA. No CAPTCHA was solved, no form was submitted, no files or links were delivered and no physical package was prepared."
  },
  {
    name: "KCSB Artist Inquiry Music Library Premiere and On-Air Submission Route",
    websiteUrl: "https://www.kcsb.org/",
    submissionUrl: "https://www.kcsb.org/contact/artist-inquiry/",
    sourceUrl: "https://www.kcsb.org/contact/artist-inquiry/",
    sourceType: "automation_run_133_public_research",
    country: "United States / Santa Barbara free-form college radio with artist inquiry form and Music Director contact route",
    language: "en",
    genres: ["kcsb", "college-radio", "freeform", "artist-inquiry", "music-library", "premiere", "live-on-air", "station-events", "music-director", "contact-form", "manual-review"],
    submissionMethod: "official-kcsb-artist-inquiry-music-library-premiere-on-air-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because KCSB offers multiple artist outcomes—library addition, live on-air performance, station events and premieres—plus Music Director email/mail/contact-form routes that require owner selection and custom pitch copy.",
    notes: "Official public research confirmed KCSB's active 2026 site, Artist Inquiry page, Google Form side route, Music Director email, music-submission mailing instructions and contact form category. No form was opened beyond public discovery, no email was sent and no music/package was delivered."
  },
  {
    name: "KFAI Music Department Music Library Email Submission Route",
    websiteUrl: "https://kfai.org/",
    submissionUrl: "https://kfai.org/about/contact/",
    sourceUrl: "https://kfai.org/about/contact/",
    sourceType: "automation_run_133_public_research",
    country: "United States / Minneapolis-Saint Paul volunteer-based community radio with Music Department and Music Library submission contact",
    language: "en",
    genres: ["kfai", "community-radio", "volunteer-radio", "eclectic", "reggae", "world", "soul", "funk", "jazz", "blues", "music-library", "email-submission", "manual-review"],
    submissionMethod: "official-kfai-music-department-music-library-email-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because KFAI asks artists to connect through its Music Department and Music Library email, warns that confirmation may not be sent, and requires a tailored music package rather than any safe auto-submit workflow.",
    notes: "Official public research confirmed KFAI's active 2026 site, current staff/contact directory, First Tracks new-music activity, and a Music Department & Music Library route inviting artists to share music by email. No email, link, file, form or package was delivered."
  }
];

export const run133SeedPlatforms: PlatformInput[] = [
  ...run133BaseSeedPlatforms,
  ...run134SeedPlatforms
];
