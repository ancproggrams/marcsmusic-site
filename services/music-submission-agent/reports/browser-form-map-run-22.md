# Browser Form Mapping — Run 22

Date: 2026-06-30

## Scope

This report records public-page browser inspection for submission routes. No forms were submitted. No accounts were created. No payment, login, CAPTCHA, OAuth, protected workflow or final submit action was used.

## Browser-tested routes

| Platform | Category | Browser result | Status |
|---|---|---|---|
| Soundplate Play — Future First | playlist_submission_oauth | Public playlist page visible, but Spotify and Deezer submission actions lead to external account authorization. | needs_manual_review |
| Indiemono Submit Music to Chill Playlists | direct_playlist_form | Public form fields visible. Can be field-mapped without submitting. | form_mapped_no_submit |
| Indiemono Release Music With Indiemono | label_release_form | Public form fields visible. Can be field-mapped without submitting. | form_mapped_no_submit |
| A&R Factory Submit Demo | editorial_review_form_with_payment_options | Multi-step form fields visible. Free option exists, but paid packages and payment fields are present. | needs_manual_review |

## Field mapping

### Soundplate Play — Future First

Observed fields and actions:

- Playlist fit confirmation.
- Spotify path.
- Deezer path.
- Follow Soundplate accounts/playlists requirement.
- Submit action routes to Spotify or Deezer authorization.

Fill strategy:

- Do not auto-fill.
- Do not click final Submit because it triggers OAuth/account authorization and follower actions.
- Mark as `needs_manual_review`.

### Indiemono Submit Music to Chill Playlists

Observed required fields:

- Name or Company Name.
- Email.
- Trackname - Artistname.
- Spotify track URL.
- Closest genre.
- Optional service interest.
- Optional service type.
- Optional territory.
- Consent checkbox.

Fill strategy:

- Artist/company: MarcsMusic.
- Email: configured artist contact.
- Trackname - Artistname: track title plus MarcsMusic.
- Spotify track URL: released Spotify track URL only.
- Closest genre: EDM or Chill depending on release.
- Territory: Global unless campaign-specific.
- Consent: manual owner approval required before final submit.
- Browser may map fields and stop before submit.

### Indiemono Release Music With Indiemono

Observed required fields:

- Name or Company Name.
- Email.
- Songname - ArtistName.
- Closest genre.
- Link to the song.
- Released-status checkbox.
- Consent checkbox.

Fill strategy:

- Use only unreleased music links unless the page says released tracks are accepted.
- Use SoundCloud, Dropbox, Drive or other non-expiring private link.
- Genre: EDM/Dance/House for MarcsMusic festival/electronic releases.
- Consent and final submit require manual owner approval.
- Browser may map fields and stop before submit.

### A&R Factory Submit Demo

Observed fields:

- Artist / Band / Name.
- Genre.
- One track review link.
- Release status.
- Release date for unreleased music.
- Website or social links.
- Artwork or artist photo URL.
- EPK URL or biography.
- Email and email confirmation.
- Music-career challenges.
- Budget range.
- Biography support question.
- Referral source.
- Package selection: Free, Standard, Premium.
- Payment fields visible for paid options.

Fill strategy:

- Select Free Submission unless manual owner approval chooses paid package.
- Fill artist name, genre, one track link, release status/date, socials, artwork, EPK/bio and email.
- Do not enter payment details.
- Do not click final submit automatically.
- Mark as `needs_manual_review` because payment fields and package choices are present.

## Classifier rules to apply to the full database

- `direct_web_form`: public form fields visible and no login/payment/CAPTCHA detected. Browser may map fields, stop before submit.
- `playlist_submission_oauth`: playlist submission requires Spotify/Deezer authorization or follow actions. Manual review only.
- `editorial_review_form_with_payment_options`: form visible but includes paid packages or payment fields. Manual review only.
- `label_release_form`: public label/release form visible. Browser may map fields, but owner consent required before submit.
- `email_submission`: public e-mail route. Validate with Mailgun SMTP before storing or sending.
- `distribution_portal`: account/upload/royalty/rights workflow. Manual review only.
- `curator_marketplace`: account, credit, targeting or payment workflow. Manual review only.
- `sync_licensing_portal`: rights/publishing/splits/license terms workflow. Manual review only.

## Safety result

Forms inspected: 4.
Forms submitted: 0.
Accounts created: 0.
OAuth flows started: 0.
Payments attempted: 0.
CAPTCHA bypasses: 0.
Protected pages bypassed: 0.
