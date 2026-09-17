# API Spec

## REST

- `GET /music/app`
- `GET /music/artists`
- `POST /music/artists`
- `GET /music/artists/:artistId`
- `PATCH /music/artists/:artistId`
- `POST /music/releases`
- `GET /music/releases/:releaseId`
- `POST /music/releases/:releaseId/plan`
- `POST /music/releases/:releaseId/publish`
- `POST /music/releases/:releaseId/player-sync`
- `POST /music/releases/:releaseId/email-campaigns/preview`
- `POST /music/releases/:releaseId/email-campaigns/test`
- `POST /music/releases/:releaseId/email-campaigns/send`
- `GET /music/email-campaigns/:campaignId`
- `GET /music/email-campaigns/:campaignId/recipients`

## Guards

Dry-run and preview endpoints may run without execution token. Real platform
publish, player sync and campaign send require `x-music-api-token` matching
`MUSIC_API_EXECUTION_TOKEN`.

