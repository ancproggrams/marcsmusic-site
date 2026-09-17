# Mailgun Campaign Spec

Mailgun is the only email sender.

## Flows

- Preview recipients and language breakdown.
- Send one test email to a supplied test recipient.
- Send campaign to selected EspoCRM contacts with execution guard.

## Requirements

- Dedupe by lowercase email.
- Exclude unsubscribed, bounced, complained, suppressed, inactive and invalid
  contacts.
- Language template fallback to English.
- If English template is missing, fail before sending.
- Mailgun tags: `new-music`, `release:<releaseId>`, `campaign:<campaignId>`,
  `type:<contactType>`, `language:<language>`.
- Store message IDs and recipient statuses.

