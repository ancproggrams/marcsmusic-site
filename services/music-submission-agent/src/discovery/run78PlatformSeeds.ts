import type { PlatformInput } from '../models/types.js';

// Run 374 deduplication correction:
// KEXP is retained once through its canonical Run 39 route.
export const run78SeedPlatforms: PlatformInput[] = [
  {
    name: "KVRX 91.7 FM Music Department Submissions",
    websiteUrl: "https://www.kvrx.org/",
    submissionUrl: "https://www.kvrx.org/app/contact/",
    sourceUrl: "https://www.kvrx.org/app/contact/",
    sourceType: "automation_run_78_public_research",
    country: "United States / Austin student-run freeform and underground radio digital and physical music submission route",
    language: "en",
    genres: ["kvrx", "college-radio", "student-radio", "freeform-radio", "underground-music", "radio-airplay", "music-department-email", "electronic", "experimental", "dub", "reggae", "world", "indie", "free", "manual-review"],
    submissionMethod: "official-kvrx-contact-page-music-department-email-and-physical-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required for outbound email or package prep, track and link selection, rights/originality checks, metadata, clean/explicit labeling, policy review and station fit.",
    notes: "Public research confirmed KVRX's active site and official contact page with music submission routing. No email was sent, no physical mail was prepared, no login was used and no SMTP/MX probing was performed."
  },
  {
    name: "KJHK 90.7 FM Submit Music",
    websiteUrl: "https://kjhk.org/web/",
    submissionUrl: "https://kjhk.org/web/submit-music/",
    sourceUrl: "https://kjhk.org/web/submit-music/",
    sourceType: "automation_run_78_public_research",
    country: "United States / Lawrence, Kansas college radio album rotation, electronic submission and local music form route",
    language: "en",
    genres: ["kjhk", "college-radio", "student-radio", "radio-airplay", "album-review", "rotation", "submitmusic-email", "local-music-form", "electronic", "dub", "reggae", "world", "indie", "alternative", "free", "manual-review"],
    submissionMethod: "official-kjhk-submit-music-page-email-cd-vinyl-and-local-form-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required for email/link package prep, no-attachment compliance, album/rotation fit, local eligibility, metadata, clean/explicit labeling, rights/originality and any external form completion.",
    notes: "Public research confirmed KJHK's official Submit Music page, current 2026 site activity and instructions for album review and rotation consideration. No email was sent, no form was submitted, no physical mail was prepared, no login route was used and no SMTP/MX probing was performed."
  },
  {
    name: "KCSU 90.5 FM Submit Your Music for Air-Play",
    websiteUrl: "https://kcsufm.com/",
    submissionUrl: "https://kcsufm.com/submitmusic/",
    sourceUrl: "https://kcsufm.com/submitmusic/",
    sourceType: "automation_run_78_public_research",
    country: "United States / Fort Collins Colorado student-run radio digital forms, inquiry emails and physical mailbox route",
    language: "en",
    genres: ["kcsu", "college-radio", "student-radio", "radio-airplay", "music-submission-form", "monday-form", "local-music", "colorado", "electronic", "dub", "reggae", "world", "indie", "alternative", "free", "manual-review"],
    submissionMethod: "official-kcsu-submit-your-music-page-external-forms-email-inquiry-and-physical-mailbox-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because external forms, local-vs-general routing, outbound inquiry email, physical package prep, metadata, release context, rights/originality, clean/explicit labeling and station fit must not be automated.",
    notes: "Public research confirmed KCSU's active 2026 site, recent staff/music activity and official Submit Your Music for Air-Play page. No external form was opened beyond route identification, no form was submitted, no email was sent, no physical mail was prepared and no SMTP/MX probing was performed."
  },
  {
    name: "KXLU 88.9 FM General and Specialty Submissions",
    websiteUrl: "https://kxlu.com/",
    submissionUrl: "https://kxlu.com/contact/",
    sourceUrl: "https://kxlu.com/contact/",
    sourceType: "automation_run_78_public_research",
    country: "United States / Los Angeles Loyola Marymount freeform radio FCC-clean physical submission route with public staff contact",
    language: "en",
    genres: ["kxlu", "college-radio", "community-radio", "freeform-radio", "demolisten", "latin-jazz", "punk", "folk", "vinyl", "electronic", "dub", "reggae", "world", "indie", "alternative", "physical-mail", "free", "manual-review"],
    submissionMethod: "official-kxlu-contact-page-fcc-clean-general-demolisten-and-specialty-physical-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required for physical package choice, FCC-clean verification, specialty routing, metadata, rights/originality, release fit and any Music Director contact.",
    notes: "Public research confirmed KXLU's active 2026 site footer, current playlist and recent 2026 blog posts. No email was sent, no physical mail was prepared, no file was transferred, no payment was made and no SMTP/MX probing was performed."
  }
];
