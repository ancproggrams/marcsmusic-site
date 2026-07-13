import type { PlatformInput } from '../models/types.js';

export const run341SeedPlatforms: PlatformInput[] = [
  {
    "name": "4ZZZ Brisbane Official Music Department Submission Form",
    "websiteUrl": "https://www.4zzz.org.au/",
    "submissionUrl": "https://jeff.4zzz.org.au/form/submit-your-music-to-4zzz",
    "sourceUrl": "https://www.4zzz.org.au/music-submissions",
    "sourceType": "automation_run_341_public_research",
    "country": "Australia / Brisbane, Queensland / independent community radio with a public artist-location field and no stated geographic exclusion on the primary form",
    "language": "en",
    "genres": [
      "electronic",
      "dance",
      "beats",
      "hip-hop",
      "experimental",
      "ambient",
      "reggae",
      "dub",
      "world-music",
      "independent-radio",
      "community-radio",
      "airplay-submission",
      "manual-review"
    ],
    "submissionMethod": "official-first-party-javascript-dependent-music-submission-form",
    "feeRequired": false,
    "feeAmount": "No submission fee, account, login or mandatory payment is stated. The official form requires JavaScript and a final broadcast-permission acknowledgement, so it must be reviewed and submitted manually.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "4ZZZ's official Music Department form requires JavaScript and asks for a contact email, artist and release details, release date, optional pre-release airplay permission, genres, credits, content warnings, a downloadable WAV or 320 kbps MP3 link, cover art, social links and final permission for broadcast. It also offers optional sensitive identity fields. A human must choose a suitable release, verify ownership and broadcast rights, decide whether pre-release permission is granted, approve personal and optional identity information, provide a compliant download, avoid Spotify-only delivery, inspect any runtime anti-spam controls and complete the final acknowledgement and submission manually.",
    "notes": "Verified on 2026-07-14 from 4ZZZ's official Music Submissions page, first-party jeff.4zzz.org.au form and current homepage. The station instructs artists to use a downloadable stream and states that non-downloadable links are not accepted. The form accepts WAV or 320 kbps MP3 through downloadable SoundCloud, Google Drive, Dropbox, OneDrive or similar routes; Spotify is not accepted, while Bandcamp or Apple Music requires a download code. The separate Album of the Week form was excluded because it is restricted to Australian artists and requires prior support across multiple 4ZZZ programs. The official homepage displayed live programming dated 2026-07-13, an Album of the Week dated 2026-07-13, current charts and scheduled 2026 events, confirming activity. reception@4zzz.org.au is publicly listed for general station contact but is not authorized as a music-submission substitute. No form field, optional identity field, permission checkbox, file, link or personal data was submitted, and no CAPTCHA, authentication or payment control was entered or bypassed."
  },
  {
    "name": "fbi.radio Official Digital Music Submission Email",
    "websiteUrl": "https://www.fbi.radio/",
    "submissionUrl": "mailto:music@fbiradio.com",
    "sourceUrl": "https://www.fbi.radio/pages/music-submissions",
    "sourceType": "automation_run_341_public_research",
    "country": "Australia / Sydney, New South Wales / independent community radio with a public digital servicing route and no stated geographic exclusion on the submission page",
    "language": "en",
    "genres": [
      "electronic",
      "dance",
      "bass-music",
      "experimental",
      "ambient",
      "reggae",
      "dub",
      "world-music",
      "independent-radio",
      "community-radio",
      "airplay-submission",
      "manual-review"
    ],
    "submissionMethod": "official-public-purpose-bound-digital-music-submission-email",
    "feeRequired": false,
    "feeAmount": "No submission fee, account, login, CAPTCHA or mandatory payment is stated for the officially published digital music-submission mailbox.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "fbi.radio explicitly directs digital music submissions to music@fbiradio.com and requests a clear artist-and-release subject, a short biography, press image or gig information, a public or private stream and a free high-quality 320 kbps MP3 or WAV download without expiry. A human must select a suitable MarcsMusic release, verify ownership, release status and geographic/editorial fit, approve the pitch, links, image and personal information, reconfirm the address and send the email manually. Direct servicing to individual programs must only use presenter addresses publicly listed on the relevant program pages and is not queued here.",
    "notes": "Verified on 2026-07-14 from fbi.radio's official contact and Music Submissions pages. Both pages publish music@fbiradio.com specifically for music submissions. The legacy fbiradio.com web domain redirects to the current official fbi.radio website, supporting the station-domain relationship; the address was otherwise validated only by official publication, syntax and stated purpose. General servicing is auditioned on Wednesdays and the station advises sending before midnight Tuesday for consideration the following week. All music must be serviced digitally; CD submissions are no longer accepted. fbi.radio says submissions are normally listened to within two to three weeks, but individual feedback is not guaranteed. Current activity was confirmed through official episodes dated 2026-07-12 and 2026-07-09 and editorial posts dated 2026-07-10 and 2026-07-03. musicinterviews@fbiradio.com, gigs@fbiradio.com, partnerships@fbiradio.com and general contact addresses were classified by their published purposes and were not used as substitute submission routes. No email, track, stream, download, image, metadata or personal data was sent, and no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed."
  }
];
