# EspoCRM Integration

EspoCRM remains the source of truth for contacts. The service reads contacts
through `src/infrastructure/espocrm/espocrm-client.mjs` and normalizes them for
campaign segmentation.

## Required Environment

- `ESPOCRM_BASE_URL`
- `ESPOCRM_API_KEY`
- `ESPOCRM_TIMEOUT_MS`

## Recommended Contact Fields

- email address
- first/last or display name
- account/organization
- contact type
- preferred language
- country
- genres
- priority
- tags
- artist audience tags
- suppression/status fields

If the production EspoCRM field names differ, map them in `normalizeEspoContact`
instead of creating a separate contact database.

