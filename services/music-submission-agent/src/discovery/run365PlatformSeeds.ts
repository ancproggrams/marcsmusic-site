import type { PlatformInput } from '../models/types.js';

export const run365SeedPlatforms: PlatformInput[] = [
  {
    name: 'CJSW 90.9 FM Digital EP and Album Jotform Submission Route',
    websiteUrl: 'https://cjsw.com/',
    submissionUrl: 'https://form.jotform.com/260625704327253',
    sourceUrl: 'https://cjsw.com/music/submit/',
    sourceType: 'automation_run_365_public_research',
    country: 'Canada / Calgary, Alberta / campus and community radio',
    language: 'en',
    genres: [
      'independent',
      'electronic',
      'electronica',
      'breakbeat',
      'dub',
      'reggae',
      'afrobeat',
      'experimental',
      'regional',
      'hip-hop',
      'campus-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'submission-form',
      'manual-review'
    ],
    submissionMethod: 'official-cjsw-guidelines-linked-third-party-jotform-full-release-upload',
    feeRequired: false,
    feeAmount: 'No editorial submission fee or mandatory payment is stated on the official guidelines or the linked form.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CJSW accepts digital EPs and albums only: the release must contain at least three unique tracks, have been released within the last three months, use MP3 files only and be uploaded as a complete ZIP archive. Singles are explicitly rejected. The official page links to a Jotform that requests contact, artist, release, label, release-date, genre, location, biography, RIYL and streaming information, plus the ZIP release, optional one-sheet and required artwork. It also asks for permission to share the release with programmers and permanently add it to the digital library. The form contains a field marked “Should be Empty,” which is an anti-spam control and must not be automated or populated. A human must confirm international eligibility, select an eligible non-single release, inspect live consent and validation controls, upload the files and submit manually. Stop if any new CAPTCHA, login, payment or platform restriction appears.',
    notes:
      'Verified on 2026-07-15 from CJSW official Music Submissions, Contact, Music Department and homepage pages and the exact Jotform linked by the station. The form is current for 2026 and includes electronic and regional genre choices. Current activity was confirmed through live and upcoming programming, 2026 Sled Island interviews, and active shows covering reggae, dub, afrobeat, electronica, breakbeat, experimental and independent music. Helen Young is publicly identified as Music & Performance Director and the first-party contact page links a purpose-bound assistance email, but the address was protected in passive rendering and was not decoded or guessed. No form, file, consent, anti-spam field, email, login, CAPTCHA or payment was submitted.'
  },
  {
    name: 'CKUT 90.3 FM Global Digital and Physical Music Department Submission Route',
    websiteUrl: 'https://ckut.ca/',
    submissionUrl: 'https://ckut.ca/submit-music-to-ckut/',
    sourceUrl: 'https://ckut.ca/submit-music-to-ckut/',
    sourceType: 'automation_run_365_public_research',
    country: 'Canada / Montreal, Quebec / non-profit campus-community radio',
    language: 'en/fr',
    genres: [
      'independent',
      'electronic',
      'electronics',
      'house',
      'techno',
      'ambient',
      'experimental',
      'avant-garde',
      'noise',
      'reggae',
      'soca',
      'dancehall',
      'global',
      'world-music',
      'hip-hop',
      'campus-radio',
      'community-radio',
      'radio-airplay',
      'digital-submission',
      'physical-submission',
      'international-submission',
      'email-submission',
      'manual-review'
    ],
    submissionMethod: 'official-ckut-music-department-email-for-320-mp3-or-authorized-physical-media',
    feeRequired: false,
    feeAmount:
      'No editorial submission fee or mandatory payment is stated. Optional physical-copy production, international postage, courier and customs costs remain with the sender.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'CKUT explicitly considers recordings sent by artists and record companies around the world. It accepts physical CDs, cassettes, 12-inch and 7-inch vinyl, and digital submissions in 320-kbps MP3 format through music@ckut.ca. Singles are rejected; except for 7-inch vinyl, a submission must contain at least three distinct tracks and remixes do not count toward that threshold. A human must select an eligible EP or album, verify that the files are 320-kbps MP3, determine a practical email delivery method that respects attachment-size limits because the page does not specify attachment-versus-download-link rules, include sufficient release metadata and send manually. Physical delivery requires manual production, postage and customs handling.',
    notes:
      'Verified on 2026-07-15 from CKUT official submission, contact and homepage pages. The submission mailbox music@ckut.ca is published both on the submission instructions and in the Music Department section of the first-party contact page. Verification covered repeated first-party publication, valid syntax, official-domain alignment and explicit music-submission purpose; no SMTP, MX, catch-all or mailbox-level probe was performed. Current operation was confirmed through the 2026 funding-drive notice, July 2026 station posts and archives, active programming, and a current catalogue spanning electronics, house, techno, ambient, experimental, global, reggae, dancehall and hip-hop. No email, file, link, physical package, login, CAPTCHA or payment was submitted.'
  }
];
