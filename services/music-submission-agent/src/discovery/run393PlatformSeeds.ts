import type { PlatformInput } from '../models/types.js';
import { run394SeedPlatforms } from './run394PlatformSeeds.js';

export const run393SeedPlatforms: PlatformInput[] = [
  {
    name: 'Fresh On The Net Weekly Listening Post Submission Route',
    websiteUrl: 'https://freshonthenet.co.uk/',
    submissionUrl: 'https://freshonthenet.co.uk/submit/',
    sourceUrl: 'https://freshonthenet.co.uk/submit/',
    sourceType: 'automation_run_393_public_research',
    country: 'United Kingdom / global independent-music discovery platform',
    language: 'en',
    genres: [
      'independent-music',
      'new-music',
      'electronic',
      'alternative',
      'pop',
      'world-fusion',
      'soundcloud-link',
      'public-form',
      'schedule-gated',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-weekly-soundcloud-link-submission-form',
    feeRequired: false,
    feeAmount: 'No submission fee, login or mandatory payment is stated for the official Fresh On The Net weekly submission form.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Fresh On The Net expressly invites any artist to submit one track per week through its first-party form, using a public, worldwide, embeddable SoundCloud URL. The inbox is schedule- and capacity-gated: it opens Monday morning and closes after 200 tracks or by Wednesday evening, whichever occurs first; it was closed on 2026-07-16 and displayed a July 20 reopening boundary. The form requires artist name, track name, SoundCloud URL and acceptance of the terms. Current first-party representations conflict on AI provenance: the closed submission page states that AI-generated tracks are never accepted, while another current form representation asks artists to declare music composed wholly or partly using AI. A human must therefore reopen the live form, apply the strictest visible provenance rule, verify that the selected MarcsMusic track is eligible, confirm the current anti-spam/CAPTCHA state and submit only during an open window. Do not email music, use the adjacent privacy mailbox, bypass the weekly capacity gate, submit a private or territory-restricted track, resubmit a previously rejected track, submit a remix or alternative version previously supplied, or use the conditional Exile FM mailbox before completing the Fresh On The Net prerequisite.',
    notes:
      'Verified on 2026-07-16 from Fresh On The Net’s official Submit, submission-help, Contact, Privacy and homepage pages. The route accepts one public, full-length, worldwide and embeddable SoundCloud track per artist per week; moderators state that every accepted track is heard. The form exposes artist name, track name, SoundCloud URL and a terms checkbox. The official Contact page says music is not considered by CD or email and directs artists to the form. Current activity was confirmed through Listening Post/Fresh Faves Batch 615 and dated July 2026 posts. The official privacy mailbox and a separately published personal Gmail address for a conditional Exile FM clean-edit route were source-verified but excluded from the canonical Fresh On The Net opportunity. No form field, terms checkbox, SoundCloud link, email, login, CAPTCHA or payment was entered or submitted, and no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed.'
  },
  ...run394SeedPlatforms
];
