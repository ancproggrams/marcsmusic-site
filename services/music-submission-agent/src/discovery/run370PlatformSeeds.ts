import type { PlatformInput } from '../models/types.js';

export const run370SeedPlatforms: PlatformInput[] = [
  {
    name: 'Fresh On The Net Weekly SoundCloud Submission and Listening Post Route',
    websiteUrl: 'https://freshonthenet.co.uk/',
    submissionUrl: 'https://freshonthenet.co.uk/submit/',
    sourceUrl: 'https://freshonthenet.co.uk/submit/',
    sourceType: 'automation_run_370_public_research',
    country: 'United Kingdom / global independent-music discovery blog and listening platform',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'ambient',
      'dub',
      'reggae',
      'bass-music',
      'hip-hop',
      'global-music',
      'music-blog',
      'editorial-discovery',
      'soundcloud-submission',
      'web-form-submission',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-weekly-form-with-public-worldwide-embeddable-soundcloud-track',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Fresh On The Net accepts one track per artist per week through its official form, opening Monday and closing at 200 submissions or Wednesday evening. The track must be a public, full, worldwide and embeddable SoundCloud URL; private, SoundCloud Go and territory-restricted tracks are rejected. Repeat tracks, remixes and alternate versions of previously submitted tracks are not accepted, and artists featured in Fresh Faves must wait three months. The live terms state that AI-generated tracks are not accepted, require explicit acceptance of the terms and prohibit publicising a Listening Post placement to influence voting. A human must confirm the selected MarcsMusic track is eligible and not AI-generated, verify that the inbox is open, review the current privacy and consent language, submit only once, and stop if a CAPTCHA, login, payment or new restriction appears.',
    notes:
      'Verified on 2026-07-15 from Fresh On The Net official Submit, Submit Help, About and Contact pages. The official site states that any artist may submit, guarantees team listening, and currently displayed DROPBOX OPEN. The About page describes a weekly 200-track cap and an independent volunteer-led editorial process, while posts dated through July 14, 2026 confirm activity. The Contact page directs music exclusively to the submission form rather than direct email or CD. No form fields, terms checkbox, SoundCloud URL, personal information, login, CAPTCHA or payment were entered or submitted.'
  },
  {
    name: 'Exile FM Del Osei-Owusu Conditional Clean-Radio-Edit Submission Route',
    websiteUrl: 'https://freshonthenet.co.uk/',
    submissionUrl: 'https://freshonthenet.co.uk/submit/',
    sourceUrl: 'https://freshonthenet.co.uk/submit/',
    sourceType: 'automation_run_370_public_research',
    country: 'United Kingdom / Exile FM radio-show consideration via Fresh On The Net',
    language: 'en',
    genres: [
      'independent',
      'alternative',
      'electronic',
      'electronica',
      'experimental',
      'dub',
      'reggae',
      'bass-music',
      'hip-hop',
      'global-music',
      'radio-airplay',
      'email-submission',
      'conditional-submission',
      'manual-review'
    ],
    submissionMethod: 'public-purpose-bound-email-with-audio-file-and-bio-after-required-fresh-on-the-net-submission',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Fresh On The Net publishes a separate purpose-bound route for Del Osei-Owusu’s Exile FM show: send a clean radio-edit audio file and biography to del.owusu@gmail.com with “radio submission” in the subject. The same first-party instruction explicitly states that a track will not be considered unless it has first been submitted to Fresh On The Net. A human must therefore complete and document an eligible Fresh On The Net submission first, confirm the Exile FM route is still active, select a clean radio edit, prepare the file and biography, use the exact subject guidance, and send manually. The address is a public Gmail role/contact rather than an official-domain mailbox, and no deliverability probe was performed. Stop if any login, CAPTCHA, payment, attachment-size, consent or updated eligibility restriction appears.',
    notes:
      'Verified on 2026-07-15 from the current Fresh On The Net official Submit page, which directly publishes the Exile FM radio-consideration instruction and mailbox. The page is active with July 2026 content and an open weekly submission inbox. Email verification covered first-party publication, valid syntax and explicit radio-submission purpose; domain alignment is not present because the address uses Gmail. Independent current Exile FM programme scheduling was not confirmed from a first-party station page, so the route remains needs_manual_review and is not an auto-submit candidate. No email, audio file, biography, subject line, attachment, login, CAPTCHA or payment was submitted.'
  }
];
