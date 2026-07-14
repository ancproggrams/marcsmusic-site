import type { PlatformInput } from '../models/types.js';

export const run344SeedPlatforms: PlatformInput[] = [
  {
    "name": "CKMS-FM 102.7 Radio Waterloo Public Music Submission Email and Contact Form",
    "websiteUrl": "https://radiowaterloo.ca/",
    "submissionUrl": "mailto:office@radiowaterloo.ca",
    "sourceUrl": "https://radiowaterloo.ca/contact-us/",
    "sourceType": "automation_run_344_public_research",
    "country": "Canada / Kitchener-Waterloo, Ontario / community radio; the public contact page explicitly accepts music submissions and states no geographic exclusion",
    "language": "en",
    "genres": [
      "electronic",
      "electronica",
      "house",
      "techno",
      "experimental",
      "ambient",
      "hip-hop",
      "reggae",
      "world-music",
      "community-radio",
      "airplay-submission",
      "manual-review"
    ],
    "submissionMethod": "official-public-purpose-bound-music-submission-email-with-first-party-contact-form",
    "feeRequired": false,
    "feeAmount": "No submission fee, account, login or mandatory payment is stated for the public music-submission email or first-party contact form.",
    "loginRequired": false,
    "captchaDetected": true,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Radio Waterloo explicitly authorizes office@radiowaterloo.ca for music submissions and offers a first-party contact form with name, email, subject and message fields. The form includes a human anti-spam knowledge question asking for the station call sign, and the linked detailed Submit Music page presented a request-verification screen during passive inspection. A human must reconfirm the current submission instructions, choose email or form, verify track fit, rights, metadata, clean or explicit status, file or link format and pitch copy, answer any anti-spam control normally and send manually. No request-verification or anti-spam control may be bypassed.",
    "notes": "Verified on 2026-07-14 from Radio Waterloo's official Contact Us page, which explicitly lists music submissions as an authorized purpose for office@radiowaterloo.ca and supplies the first-party form. The public page displayed July 2026 archives, recent July 2026 program comments and active electronic, experimental, techno, reggae, world and hip-hop programming. The separate Submit Music page returned a request-verification loader and was not bypassed, so detailed audio-delivery rules remain a manual pre-submission check. The address was validated only through official publication, syntax, first-party domain alignment and stated business purpose; no SMTP, MX, catch-all, mailbox-level or deliverability probe was performed. The knowledge question is classified conservatively as a human-verification boundary rather than an automated-submission opportunity."
  },
  {
    "name": "CJAI 101.3 FM Island Radio First-Party Music Upload Form",
    "websiteUrl": "https://www.cjai.ca/",
    "submissionUrl": "https://www.cjai.ca/music-submissions",
    "sourceUrl": "https://www.cjai.ca/music-submissions",
    "sourceType": "automation_run_344_public_research",
    "country": "Canada / Eastern Ontario community radio; the first-party form includes a local-artist Yes/No field, while the linked Radio Free Stella sister station is reserved for Eastern Ontario artists",
    "language": "en",
    "genres": [
      "electronic",
      "indie",
      "folk",
      "country",
      "rock",
      "pop",
      "community-radio",
      "independent-radio",
      "audio-upload",
      "airplay-submission",
      "manual-review"
    ],
    "submissionMethod": "official-first-party-audio-upload-and-artist-metadata-form",
    "feeRequired": false,
    "feeAmount": "No submission fee, account, login or mandatory payment is stated for the official first-party music-upload form.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "CJAI's official form requires an artist or band name, biography, one MP3, WAV or M4A audio upload up to 16 MB, local-artist status, city and province, contact name, contact email and optional website; an optional JPG, PNG or WebP image up to 4 MB may also be supplied. Submitted MP3 files must contain complete title, artist, album or EP, genre, year and contact metadata. A human must confirm that a non-local MarcsMusic release is being submitted for the main 101.3 FM rotation rather than the local-only Radio Free Stella lane, verify ownership and broadcast eligibility, inspect any runtime validation or privacy wording, prepare approved metadata and assets and submit manually.",
    "notes": "Verified on 2026-07-14 from CJAI's official Music Submissions, Contact and homepage pages. The form explicitly provides Yes and No choices for local-artist status and invites creators to seek rotation on 101.3 FM and/or Radio Free Stella; the page separately defines Radio Free Stella as local Eastern Ontario music only. The main homepage advertised the submission route and a show dedicated to newly submitted music, and displayed a Special Members' Meeting dated 2026-07-13, confirming current activity. The official site publishes air@cjai.ca as a general station contact, but the Contact page directs music submissions to the dedicated upload form, so the mailbox was not queued as an alternate submission route. No form field was completed, no file or image was uploaded and no runtime anti-spam control was tested."
  }
];
