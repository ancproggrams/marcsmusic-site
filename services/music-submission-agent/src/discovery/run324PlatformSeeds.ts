import type { PlatformInput } from '../models/types.js';

export const run324SeedPlatforms: PlatformInput[] = [
  {
    "name": "Kiss FM Australia Producer Music Airplay Submission",
    "websiteUrl": "https://kissfm.com.au/",
    "submissionUrl": "https://kissfm.com.au/unsigned",
    "sourceUrl": "https://kissfm.com.au/unsigned",
    "sourceType": "automation_run_324_public_research",
    "country": "Australia / Melbourne independent dance and electronic radio streaming locally and internationally",
    "language": "en",
    "genres": [
      "kiss-fm-australia",
      "dance",
      "electronic",
      "house",
      "techno",
      "bass",
      "underground",
      "radio-airplay",
      "contact-form",
      "download-link",
      "honeypot",
      "protected-contact",
      "manual-review"
    ],
    "submissionMethod": "official-first-party-programming-contact-form-or-authorized-audio-delivery-route",
    "feeRequired": false,
    "feeAmount": "The official producer submission page describes the application as free. Membership, patron and advertising routes shown elsewhere on the site are separate and are not submission requirements.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Kiss FM directs producers to its official contact form and requires Programming routing, rights to distribute the submitted track, specific genre, artist and release details, a text biography, origin, artwork, release date and label information, plus either MP3/WAV delivery, a password-free Dropbox link or a private downloadable SoundCloud link. YouTube and Spotify links are explicitly rejected. The contact form contains a honeypot field, and the alternate station delivery address is protected in passive extraction. A human must select the Programming category, leave the honeypot untouched, verify rights and link permissions, approve any attachment or artwork and submit manually.",
    "notes": "Verified on 2026-07-13 from Kiss FM Australia's official Submit Your Music, contact and active station pages. The station states that it serves local and international electronic-music listeners, accepts all forms of dance music except commercial material already played by commercial stations, and cannot reply to every submission. The official site showed July 2026 news and a June 2026 A-rotation update. The contact form requests email, name, subject, query category and message and exposes a honeypot field. The direct station delivery address remained protected and was not decoded. No form was completed, no email or file was sent, no link was shared and no SMTP, MX or mailbox probe was performed."
  },
  {
    "name": "Fresh 92.7 Adelaide Local Electronic Music Enquiry Route",
    "websiteUrl": "https://www.fresh927.com.au/",
    "submissionUrl": "mailto:music@fresh927.com.au",
    "sourceUrl": "https://www.fresh927.com.au/faqs",
    "sourceType": "automation_run_324_public_research",
    "country": "Australia / Adelaide youth and community dance-radio station with a public music-enquiries mailbox",
    "language": "en",
    "genres": [
      "fresh-927",
      "community-radio",
      "youth-radio",
      "dance",
      "electronic",
      "house",
      "local-artists",
      "music-enquiry",
      "direct-email",
      "manual-review"
    ],
    "submissionMethod": "official-public-music-enquiries-email-with-local-artist-eligibility-boundary",
    "feeRequired": false,
    "feeAmount": "No submission fee, login or payment requirement is stated for the official music-enquiries mailbox.",
    "loginRequired": false,
    "captchaDetected": false,
    "paymentRequired": false,
    "manualReviewRequired": true,
    "manualReviewReason": "Fresh 92.7 publicly directs local artists to music@fresh927.com.au but does not publish accepted file or link formats, release-age limits, attachment rules, metadata requirements, rights declarations, AI-origin policy or response expectations. Because the wording is explicitly local-artist focused, MarcsMusic's eligibility as a Netherlands-based artist must be confirmed before any assets are sent. A human should first prepare an asset-light enquiry or confirm international eligibility, then approve the pitch, track choice and delivery method.",
    "notes": "Verified on 2026-07-13 from Fresh 92.7's official FAQ and live station pages. The station describes itself as an Adelaide youth and community broadcaster presenting international and local music and says it was created to serve demand for electronic music. Its FAQ publishes music@fresh927.com.au specifically for music enquiries from local artists; admin and sponsorship addresses are not submission alternatives. The official site displayed a live player and current weekly shows including Fresh Off The Block. The music mailbox was checked for first-party publication, syntax, domain alignment and role relevance only. No email was sent and no SMTP, MX, catch-all, mailbox or deliverability probe was performed."
  }
];
