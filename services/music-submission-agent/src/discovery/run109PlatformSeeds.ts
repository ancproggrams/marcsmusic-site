import type { PlatformInput } from '../models/types.js';
import { run110SeedPlatforms } from './run110PlatformSeeds.js';

const run109OriginalSeedPlatforms: PlatformInput[] = [
  {
    name: "KRCL 90.9FM Physical and Utah Local Digital Music Submission Route",
    websiteUrl: "https://krcl.org/",
    submissionUrl: "https://krcl.org/how-to-submit-music/",
    sourceUrl: "https://krcl.org/how-to-submit-music/",
    sourceType: "automation_run_109_public_research",
    country: "United States / Salt Lake City community radio and local digital submission route",
    language: "en",
    genres: ["krcl", "community-radio", "college-radio-adjacent", "independent-music", "local-music", "utah-artists", "electronic", "reggae", "dub", "world", "hip-hop", "alternative", "physical-mail", "google-form", "free-first", "manual-review"],
    submissionMethod: "official-krcl-physical-and-utah-local-digital-music-submission-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because KRCL prioritizes physical CDs for general submissions and uses an external Google form for Utah-based local digital submissions; release locality, physical package prep, links, metadata and no-reply/no-airplay-guarantee expectations must be checked manually.",
    notes: "Public research confirmed KRCL is active in July 2026 with current programming and event content. Its official How to Submit Music page says music is reviewed by DJs, gives a physical CD route, says not to send demos or CD-Rs, and offers an external Google form route for Utah-based digital local submissions. No form was opened beyond the public route, no package was prepared, no message was sent and no session or anti-bot control was bypassed."
  },
  {
    name: "KXT 91.7 Music Submissions Wufoo Form Route",
    websiteUrl: "https://kxt.org/",
    submissionUrl: "https://kxt.org/music-submissions/",
    sourceUrl: "https://kxt.org/music-submissions/",
    sourceType: "automation_run_109_public_research",
    country: "United States / Dallas-Fort Worth public radio music submission form",
    language: "en",
    genres: ["kxt", "public-radio", "music-discovery", "independent-music", "electronic", "world", "reggae", "dub", "pop", "alternative", "wufoo-form", "downloadable-wav", "streaming-link", "free-first", "manual-review"],
    submissionMethod: "official-kxt-music-submissions-wufoo-form-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because KXT's official submission path is an external Wufoo form for one song and requires artist/release fields, a streaming link, a downloadable WAV link, rights authorization language and station-fit review before use.",
    notes: "Public research confirmed KXT is active in July 2026 with current music posts. The official Music Submissions page asks artists to review notes before submitting, says there is no guarantee of airplay or response, requires one song only, asks for a streaming link and a downloadable WAV link, and embeds an online Wufoo form. No form was submitted, no WAV/download link was delivered and no session control was bypassed."
  },
  {
    name: "Radio K KUOM Physical and Digital Music Department Submission Route",
    websiteUrl: "https://www.radiok.org/",
    submissionUrl: "https://www.radiok.org/about/submit-music/",
    sourceUrl: "https://www.radiok.org/about/submit-music/",
    sourceType: "automation_run_109_public_research",
    country: "United States / Minnesota student-run independent radio music department",
    language: "en",
    genres: ["radio-k", "kuom", "student-run-radio", "independent-music", "nacc", "college-radio", "electronic", "world", "reggae", "dub", "hip-hop", "alternative", "physical-mail", "digital-download", "fcc-clean", "redacted-contact", "free-first", "manual-review"],
    submissionMethod: "official-radio-k-kuom-physical-and-digital-music-department-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because Radio K accepts physical CDs and digital packages through the Music Department, requires one-sheet/bio/contact/FCC notes and lossless or high-quality download links, and the public email was redacted by the fetch layer and must not be decoded or guessed.",
    notes: "Public research confirmed Radio K is active in 2026 with current rotation, playlist and new-addition content. The official Submit Music page accepts physical releases and digital packages, asks for Google Drive/Dropbox-style ZIP download links, high-quality WAV/FLAC, one-sheet, short bio, contact information, 2-3 song suggestions and FCC-friendly guidance. No email was sent, no protected contact was decoded, no download link was delivered and no mailbox probing was performed."
  },
  {
    name: "WREK Atlanta Music Director Email and Snail Mail Submission Route",
    websiteUrl: "https://wrek.org/",
    submissionUrl: "https://old.wrek.org/submissions/",
    sourceUrl: "https://old.wrek.org/submissions/",
    sourceType: "automation_run_109_public_research",
    country: "United States / Atlanta student-managed college radio music director route",
    language: "en",
    genres: ["wrek", "georgia-tech-radio", "college-radio", "student-managed-radio", "independent-music", "quality-diverse-music", "electronic", "reggae", "dub", "world", "afrobeat", "hip-hop", "experimental", "physical-mail", "music-director-email", "free-first", "manual-review"],
    submissionMethod: "official-wrek-atlanta-music-director-email-and-snail-mail-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because WREK supports email and snail-mail music submissions but prioritizes common physical media, does not acknowledge receipt, and requires station-fit, clean/edit and package-prep review before any outreach.",
    notes: "Public research confirmed WREK is active in 2026 with current playlists and diverse specialty programming including electronic, reggae/dub, world, afrobeat, hip-hop and experimental shows. Its official submission page lists snail mail plus a Music Director email, says CDs and LPs have a better chance of airplay, and states receipt is not acknowledged. No email was sent, no physical package was prepared and no follow-up/status request was made."
  },
  {
    name: "WPRB Princeton Music Submissions Email and Physical Priority Route",
    websiteUrl: "https://wprb.com/",
    submissionUrl: "https://wprb.com/music-submissions/",
    sourceUrl: "https://wprb.com/music-submissions/",
    sourceType: "automation_run_109_public_research",
    country: "United States / Princeton independent community-supported radio music submission route",
    language: "en",
    genres: ["wprb", "princeton-radio", "community-supported-radio", "independent-radio", "new-music", "electronic", "world", "reggae", "dub", "experimental", "alternative", "physical-mail", "music-submissions-email", "free-first", "manual-review"],
    submissionMethod: "official-wprb-music-submissions-email-and-physical-priority-route",
    feeRequired: false,
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Human review is required because WPRB accepts physical media and a public music email but explicitly prioritizes physical submissions, so package choice, metadata, clean edits, release fit and no-spam pitch wording need manual review.",
    notes: "Public research confirmed WPRB is active in July 2026 with current schedules, playlists, news posts and concert listings. Its official Music Submissions page invites artists, labels and promoters to submit new music, lists physical media formats and Music Director mailing address, and gives a public music email while noting physical submissions are prioritized. No email was sent, no package was prepared and no contact probing was performed."
  }
];

export const run109SeedPlatforms: PlatformInput[] = [
  ...run109OriginalSeedPlatforms,
  ...run110SeedPlatforms
];