import type { PlatformInput } from '../models/types.js';

export const run12SeedPlatforms: PlatformInput[] = [
  {
    name: 'STMPD RCRDS Demo and A&R Route',
    websiteUrl: 'https://stmpdrcrds.com/',
    submissionUrl: 'https://stmpdrcrds.com/',
    sourceUrl: 'https://stmpdrcrds.com/',
    sourceType: 'automation_run_12_public_research',
    country: 'Netherlands / global',
    language: 'en',
    genres: ['electronic', 'edm', 'house', 'future bass', 'trap', 'progressive house'],
    submissionMethod: 'electronic-label-a-and-r-demo-route-needs-current-form-mapping',
    manualReviewRequired: true,
    manualReviewReason:
      'STMPD RCRDS is a relevant Dutch electronic label, but the current public authorized demo route could not be safely form-mapped in this run. Confirm the active A&R/demo route, required fields and asset policy manually before submission.',
    notes:
      'Research verified label relevance for electronic, future bass, trap and progressive house. No login, CAPTCHA, protected workflow or form submission was attempted.'
  },
  {
    name: 'Revealed Recordings Demo and A&R Route',
    websiteUrl: 'https://revealedrecordings.com/',
    submissionUrl: 'https://revealedrecordings.com/',
    sourceUrl: 'https://revealedrecordings.com/',
    sourceType: 'automation_run_12_public_research',
    country: 'Netherlands / global',
    language: 'en',
    genres: ['electronic', 'edm', 'electro house', 'big room house', 'progressive house', 'bass house'],
    submissionMethod: 'electronic-label-a-and-r-demo-route-needs-current-form-mapping',
    manualReviewRequired: true,
    manualReviewReason:
      'Revealed Recordings is relevant for MarcsMusic-style EDM, but the active public demo workflow and any login, upload, CAPTCHA or third-party requirements must be manually confirmed before queueing an auto-submit job.',
    notes:
      'Research verified the label as a Dutch EDM label associated with electro house, big room, progressive house and bass house. No protected route was opened.'
  },
  {
    name: 'Protocol Recordings Demo and Protocol Radio Discovery Route',
    websiteUrl: 'https://www.protocolrecordings.com/',
    submissionUrl: 'https://www.protocolrecordings.com/',
    sourceUrl: 'https://www.protocolrecordings.com/',
    sourceType: 'automation_run_12_public_research',
    country: 'Netherlands / global',
    language: 'en',
    genres: ['electronic', 'edm', 'progressive house', 'electro house', 'big room', 'dance'],
    submissionMethod: 'electronic-label-and-radio-show-demo-discovery-route-needs-manual-routing',
    manualReviewRequired: true,
    manualReviewReason:
      'Protocol Recordings and Protocol Radio are relevant EDM discovery channels, but any current demo intake, radio-show submission, upload requirements and rights policy must be reviewed manually.',
    notes:
      'Research verified Protocol Recordings as Nicky Romero’s Dutch electronic label and Protocol Radio as a discovery/show route. No form submission or account workflow was attempted.'
  },
  {
    name: 'Dim Mak Records Demo and Publishing Route',
    websiteUrl: 'https://dimmak.com/',
    submissionUrl: 'https://dimmak.com/',
    sourceUrl: 'https://dimmak.com/',
    sourceType: 'automation_run_12_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['electronic', 'edm', 'bass', 'trap', 'indie', 'hip hop', 'sync'],
    submissionMethod: 'label-publishing-and-sync-route-needs-current-contact-or-demo-form-review',
    manualReviewRequired: true,
    manualReviewReason:
      'Dim Mak is a relevant independent label and publishing/sync route, but current demo intake, publishing terms, sync rights and contact workflow require human review before any outreach or submission.',
    notes:
      'Research verified Dim Mak as an active independent LA-based label with electronic dance music and publishing/sync activity. No business email was guessed or verified.'
  },
  {
    name: 'Black Hole Recordings Demo and Trance Label Route',
    websiteUrl: 'https://www.blackholerecordings.com/',
    submissionUrl: 'https://www.blackholerecordings.com/',
    sourceUrl: 'https://www.blackholerecordings.com/',
    sourceType: 'automation_run_12_public_research',
    country: 'Netherlands / global',
    language: 'en',
    genres: ['electronic', 'trance', 'progressive trance', 'edm', 'dance'],
    submissionMethod: 'trance-label-demo-route-needs-current-form-and-rights-review',
    manualReviewRequired: true,
    manualReviewReason:
      'Black Hole Recordings is relevant for electronic/trance submissions, but the current public demo intake, label/sub-label fit, upload requirements and rights terms must be reviewed manually.',
    notes:
      'Research verified Black Hole Recordings as a Dutch trance/progressive-trance label. No demo form was submitted and no protected workflow was opened.'
  },
  {
    name: 'UKF Bass Music Editorial and Label Discovery Route',
    websiteUrl: 'https://ukf.com/',
    submissionUrl: 'https://ukf.com/',
    sourceUrl: 'https://ukf.com/',
    sourceType: 'automation_run_12_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['bass music', 'dubstep', 'drum and bass', 'electronic', 'edm'],
    submissionMethod: 'bass-music-editorial-label-and-youtube-discovery-route-needs-manual-routing',
    manualReviewRequired: true,
    manualReviewReason:
      'UKF is highly relevant for dubstep, bass and drum and bass discovery, but no safe current public submission form was mapped in this run. Editorial, label or upload rules require manual confirmation.',
    notes:
      'Research verified UKF as a global bass-music brand, label and channel network. Treat as manual-review discovery until a current authorized submission path is confirmed.'
  },
  {
    name: 'Circus Records Bass Music Demo Route',
    websiteUrl: 'https://www.circus-records.co.uk/',
    submissionUrl: 'https://www.circus-records.co.uk/',
    sourceUrl: 'https://www.circus-records.co.uk/',
    sourceType: 'automation_run_12_public_research',
    country: 'United Kingdom / global',
    language: 'en',
    genres: ['dubstep', 'bass music', 'electronic', 'edm'],
    submissionMethod: 'bass-music-label-demo-route-needs-current-form-mapping',
    manualReviewRequired: true,
    manualReviewReason:
      'Circus Records is relevant for dubstep/bass music, but current demo intake, required fields, upload limits, streaming-link policy and any account/CAPTCHA restrictions must be manually mapped.',
    notes:
      'Research verified Circus Records as an active UK independent dubstep/electronic label associated with Flux Pavilion and Doctor P. No form was submitted.'
  },
  {
    name: 'Ophelia Records Melodic Bass Demo Route',
    websiteUrl: 'https://opheliarecords.com/',
    submissionUrl: 'https://opheliarecords.com/',
    sourceUrl: 'https://opheliarecords.com/',
    sourceType: 'automation_run_12_public_research',
    country: 'United States / global',
    language: 'en',
    genres: ['dubstep', 'melodic bass', 'edm', 'drum and bass', 'psytrance', 'electronic'],
    submissionMethod: 'melodic-bass-label-demo-route-needs-current-intake-and-rights-review',
    manualReviewRequired: true,
    manualReviewReason:
      'Ophelia Records is relevant for melodic bass and electronic music, but any current demo intake, A&R routing, upload terms and rights policy require manual confirmation before submission.',
    notes:
      'Research verified Ophelia Records as Seven Lions’ label for dubstep, EDM, drum and bass and melodic bass. No account, payment, CAPTCHA or protected flow was touched.'
  }
];
