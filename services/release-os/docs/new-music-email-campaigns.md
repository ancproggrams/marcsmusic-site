# New Music Email Campaigns

Plunk is the application sender and EspoCRM is the only contact source. Plunk
delivery must use the approved MXRoute SMTP transport; AWS SES is not allowed.
See [the Plunk delivery runbook](plunk.md).

## Flow

1. Upload or select a release.
2. Sync the release to the player so `playerUrl`, `mp3DownloadUrl` and
   `wavDownloadUrl` are available.
3. Preview recipients from EspoCRM filters.
4. Send a guarded test email.
5. Send the guarded campaign.

## Filters

- `selectedTypes`
- `selectedTags`
- `selectedLanguages`
- `selectedCountries`
- `selectedGenres`
- `selectedPriorities`
- artist audience via artist slug

Suppressed contacts are always excluded: unsubscribed, bounced, complained,
suppressed, inactive, invalid email and duplicate email.

## Language

Templates support `nl`, `en`, `de`, `fr`, and `es`. Missing language templates
fall back to English. Missing English subject/body fails before sending.

## Mailgun Tags

- `new-music`
- `release:<releaseId>`
- `campaign:<campaignId>`
- `type:<contactType>`
- `language:<language>`
