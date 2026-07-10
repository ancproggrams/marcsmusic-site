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

Railway may call only the minimal public `GET /livez`. The diagnostic
`GET /health` route is protected and reports:

- API status
- Mailgun configured
- EspoCRM configured
- player manifest path
- upload directory

## Required Environment

Use `.env.example` as the source of truth. Real sends/uploads/syncs require
`MUSIC_API_EXECUTION_TOKEN`.

## Authentication deployment gate

The repository intentionally has no runtime OIDC/session adapter yet. Except
for `GET /livez`, Release OS therefore fails closed with 503. Do not deploy this
revision until a reviewed identity provider adapter, secure browser-session and
CSRF-token delivery, service identities, role mapping, and exact
`RELEASE_OS_ALLOWED_ORIGINS` are configured and tested. The execution token is
an additional capability for external effects; it is never a login credential.
