import type { PlatformInput } from '../models/types.js';

export const run478SeedPlatforms: PlatformInput[] = [
  {
    name: 'YardHype Radio Free Song Submission',
    websiteUrl: 'https://yardhyperadio.com/',
    submissionUrl: 'https://yardhyperadio.com/song-submition/',
    sourceUrl: 'https://yardhyperadio.com/song-submition/',
    sourceType: 'automation_run_478_public_research',
    country:
      'United States / Jamaica-focused worldwide online radio and entertainment platform; the official route states that approved artists can reach a global audience.',
    language: 'en',
    genres: [
      'reggae',
      'dancehall',
      'hip-hop',
      'Afrobeat',
      'R&B',
      'pop',
      'Caribbean',
      'fan-voting',
      'direct-upload',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public direct-upload form for one song file and optional artwork, with possible courtesy airplay, chart placement and fan voting',
    feeRequired: false,
    feeAmount:
      'No mandatory fee is published for the standard submission and fan-vote route; separate paid airplay-promotion packages are optional and excluded.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Direct audio and optional artwork uploads, track and metadata quality, composition/master/sample/contributor/artwork rights, the non-exclusive promotional-airplay licence, fan-voting participation, optional paid-promotion separation, AI eligibility, hidden anti-spam controls and final submission require human and legal approval.',
    notes:
      'Passively verified on 2026-07-18 from the official submission, homepage, fan-vote and current music pages. The form accepts MP3, M4A or WAV plus optional JPG/PNG artwork, and states that submission grants a non-exclusive broadcast licence for promotional airplay. Approved tracks may enter the live chart and fan voting. The site published new music through July 13, 2026 and an active fan-vote round in March 2026. No first-party public submission email was identified; the form is the stored authorized route. No email was sent, no form field was filled, no file was selected or uploaded, no vote was cast, no licence or consent was accepted, no login was used, no CAPTCHA or anti-spam control was bypassed and no payment or submission action was performed.'
  },
  {
    name: 'UnityXM Radio Reggae Samplers Submission',
    websiteUrl: 'https://unityxm.com/',
    submissionUrl: 'https://vibes.unityxm.com/',
    sourceUrl: 'https://vibes.unityxm.com/',
    sourceType: 'automation_run_478_public_research',
    country:
      'Jamaica / worldwide 24/7 online Caribbean music-discovery station; the official site expressly describes listeners and participation from around the world.',
    language: 'en',
    genres: [
      'reggae',
      'Afro-Caribe',
      'soca',
      'kompa',
      'fusion',
      'contemporary dancehall',
      'urban dancehall',
      'Caribbean',
      'clean-content',
      'external-disco-upload',
      'manual-review'
    ],
    submissionMethod:
      'official first-party submission guidance linking to a public external DISCO upload inbox for a released clean track, cover art and high-quality audio',
    feeRequired: false,
    feeAmount:
      'No mandatory submission fee is published on the official UnityXM guidance page; the linked external form remains a manual-review boundary.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route links to an external DISCO upload inbox that could not be passively inspected. Official-release availability, strict clean-content and theme rules, genre and production fit, minimum 1000x1000 artwork, MP3/WAV quality, music and image rights, AI eligibility, external-provider authentication/CAPTCHA/terms/upload limits and final upload require human review.',
    notes:
      'Passively verified on 2026-07-18 from the official UnityXM pages. UnityXM describes 24/7 broadcasting from Kingston and a worldwide listener-driven music-discovery experience. It requires music to be officially released and searchable on major platforms, rejects explicit lyrics and specified themes, prefers Reggae, Afro-Caribe, Fusions and Contemporary Dancehall, and asks for at least 1000x1000 artwork plus a high-quality MP3 or WAV. The linked skankn.disco.ac upload inbox returned a cache-miss during passive retrieval and was not accessed through authentication or automation. No first-party public business or submission email was surfaced; third-party directory addresses were excluded. No form field was filled, no file was uploaded, no login was attempted, no CAPTCHA or anti-spam control was bypassed and no payment or submission action was performed.'
  },
  {
    name: 'M3 Radio New Independent Music Submission',
    websiteUrl: 'https://www.m3radio.com/',
    submissionUrl: 'mailto:m3newmusic@yahoo.com',
    sourceUrl: 'https://www.m3radio.com/submission-info/',
    sourceType: 'automation_run_478_public_research',
    country:
      'United States / worldwide Internet broadcast; the station streams online, while eligibility for every international artist is not explicitly guaranteed on the submission page.',
    language: 'en',
    genres: [
      'independent music',
      'electronic',
      'world',
      'hip-hop',
      'jazz',
      'heavy',
      'rock',
      'AIFF',
      'WAV',
      'MP3',
      'download-link',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public music-director mailbox preferring a download link for a release no more than one year old',
    feeRequired: false,
    feeAmount:
      'No submission fee or mandatory payment is published for the official email route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Release-age eligibility, track and specialty-format fit, AIFF/WAV/MP3 quality, MP3 bitrate, download-link accessibility and least-privilege sharing, metadata, composition/master/sample/contributor rights, international and AI eligibility, optional photograph rights and final email transmission require human approval.',
    notes:
      'Passively verified on 2026-07-18 from the official submission page and its linked Live365 station profile. The station says it broadcasts new independent music 24/7 and reports Top 200 plus Hip Hop, Heavy, Electronic, World and Jazz charts to NACC. It prefers a download link, accepts AIFF, WAV or MP3 at 128 kbps or higher, requires submissions to be no more than one year old and no longer accepts CDs. m3newmusic@yahoo.com is first-party published, syntactically valid and explicitly designated for music submissions, but it uses a consumer email domain rather than m3radio.com. No SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email was drafted or sent, no link was shared, no attachment was added, no login was used and no payment or submission action was performed.'
  }
];
