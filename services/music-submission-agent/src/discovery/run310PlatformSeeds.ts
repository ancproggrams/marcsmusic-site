import type { PlatformInput } from '../models/types.js';

export const run310SeedPlatforms: PlatformInput[] = [
  {
    name: 'Barong Family Protected Public Demo Email Route',
    websiteUrl: 'https://www.barongfamily.com/',
    submissionUrl: 'https://www.barongfamily.com/',
    sourceUrl: 'https://www.barongfamily.com/',
    sourceType: 'automation_run_310_public_research',
    country: 'Netherlands / Amsterdam global trap, bass and electronic label',
    language: 'en',
    genres: [
      'barong-family',
      'trap',
      'future-bass',
      'bass-house',
      'dubstep',
      'drum-and-bass',
      'hard-dance',
      'electronic',
      'protected-email',
      'manual-review'
    ],
    submissionMethod: 'official-barong-family-protected-public-demo-email-route',
    feeRequired: false,
    feeAmount: 'Barong Family states on its official website that demos can be sent to a dedicated address. No submission fee or payment requirement is stated on the reviewed public page.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: 'Barong Family explicitly publishes a demo-email route on its official homepage, but the address is protected or omitted in the passive extraction and was not decoded or guessed. A human must open the official page, verify the visible destination, select a genre-appropriate finished track, review rights, release status, link permissions, metadata and any live instructions, and approve the final email. Do not substitute a guessed mailbox.',
    notes: 'Verified on 2026-07-12 from Barong Family\'s official website, which states that demos can be sent to a dedicated address. Current label activity was corroborated through the active Barong Family Beatport catalogue, including releases dated 2026-02-27 and 2026-02-20 across trap, future bass, dance/pop and related bass genres. The protected demo address was not decoded, copied into the dataset or probed. No email, audio, file, private link, metadata, account, CAPTCHA or payment workflow was used.'
  }
];
