import type { PlatformInput } from '../models/types.js';

export const run364SeedPlatforms: PlatformInput[] = [
  {
    name: 'KXCI 91.3FM Global Digital Album Email and Physical Music Submission Route',
    websiteUrl: 'https://kxci.org/',
    submissionUrl: 'https://kxci.org/about/music-department/',
    sourceUrl: 'https://kxci.org/about/music-department/',
    sourceType: 'automation_run_364_public_research',
    country: 'United States / Tucson, Arizona / independent community radio',
    language: 'en',
    genres: [
      'independent',
      'electronic',
      'electro-pop',
      'ambient',
      'experimental',
      'dub',
      'reggae',
      'global',
      'world-music',
      'hip-hop',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'international-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-kxci-protected-music-department-email-for-digital-albums-or-authorized-physical-media',
    feeRequired: false,
    feeAmount:
      'No editorial submission fee or mandatory payment is stated. Optional physical-copy production, international postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KXCI explicitly accepts music from around the world and accepts CDs, vinyl accompanied by a digital download, and MP3 or WAV download links for digital albums. Required information includes artist name, album title, artwork, timed track list, label or self-release status, release date, genres and comparable artists, explicit-content disclosures with lyrics where available, a brief biography, social links, regional performance information and contact details. Digital submissions are directed to the Music Department email action, but the destination is protected in passive rendering and must not be decoded, inferred or guessed. A human must open the first-party page, use the displayed authorized address, select an eligible album, confirm rights and clean-content metadata, prepare stable download access and send manually. International physical CDs or vinyl are also authorized but require manual production, postage and customs handling.',
    notes:
      'Verified on 2026-07-14 from KXCI official Music Department, homepage and programming pages. The station expressly states that it accepts and broadcasts music from all over the world and publishes separate national and international physical-delivery instructions. Current activity was confirmed through live playlist and archive navigation, official news dated through July 10, 2026, recent podcasts through July 12, 2026 and scheduled July-August 2026 programming. Relevant programming includes electronic, electro-pop, global, reggae, experimental and eclectic music. The local-only route was excluded. No protected email was decoded, no email, download link, package, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'Radio Boise KRBX First-Party Dynamic Music Submission Form',
    websiteUrl: 'https://radioboise.org/',
    submissionUrl: 'https://radioboise.org/support/submit-your-music/',
    sourceUrl: 'https://radioboise.org/support/submit-your-music/',
    sourceType: 'automation_run_364_public_research',
    country: 'United States / Boise, Idaho / independent community radio',
    language: 'en',
    genres: [
      'independent',
      'eclectic',
      'electronic',
      'global',
      'experimental',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'submission-form',
      'manual-review'
    ],
    submissionMethod: 'official-radio-boise-first-party-dynamic-submit-your-music-page',
    feeRequired: false,
    feeAmount: 'No submission fee or mandatory payment was visible on the passively rendered first-party route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Radio Boise provides a dedicated first-party Submit Your Music route, but its submission interface and instructions did not render in the passive client and displayed only a loading state. A human must open the official page normally and inspect the live fields, accepted release types, audio or link requirements, metadata, rights and consent language, international eligibility, privacy terms and any CAPTCHA, login, payment, upload or anti-spam controls. Stop at any protected, authenticated or paid boundary. The station publishes general management, programming, operations, marketing and studio business contacts, but none was identified by the reviewed first-party pages as the authorized music-submission destination; those addresses must not be used as substitutes or workarounds.',
    notes:
      'Verified on 2026-07-14 from Radio Boise official homepage, Submit Your Music and Staff pages. The site navigation repeatedly links the dedicated first-party submission page. Current activity was confirmed by a June 22, 2026 anniversary-concert announcement, live-listening and current-playlist navigation, and active staff listings. The submission page is dynamically loaded, so live CAPTCHA, login, payment and international-eligibility status remain unconfirmed rather than being guessed. Public staff addresses were classified as adjacent business contacts only and were not queued. No form, email, field, file, login, CAPTCHA, payment or anti-bot control was entered or bypassed.'
  }
];
