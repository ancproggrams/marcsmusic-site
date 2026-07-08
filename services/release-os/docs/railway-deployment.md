# Railway Deployment

The Railway CLI is linked to workspace `Marc 's Projects`, project
`marcsmusic-site`, production environment. Relevant services observed:

- `marcsmusic-site`
- `music-submission-agent`
- `marcsmusic-crm`
- `marcsmusic-calendar`
- MySQL

Deploy this app into the same Railway project, preferably with a Railway volume
for `MUSIC_UPLOAD_DIR` and `MARCSMUSIC_PLAYER_MANIFEST_PATH`.

## Health Check

`GET /health` reports:

- API status
- Mailgun configured
- EspoCRM configured
- player manifest path
- upload directory

## Required Environment

Use `.env.example` as the source of truth. Real sends/uploads/syncs require
`MUSIC_API_EXECUTION_TOKEN`.

