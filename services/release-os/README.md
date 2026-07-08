# MarcsMusic

This repository currently contains MarcsMusic integration tooling and brand assets.

## Mailgun

Mailgun email sending is implemented through a small Node ESM client:

- `src/infrastructure/mailgun/mailgun-client.mjs`
- `src/application/email/email-service.mjs`
- `scripts/send-test-email.mjs`

Set environment variables from `.env.example`, then run:

```bash
npm run verify
npm run mailgun:send-test
```

See `docs/mailgun.md` for configuration and operational notes.

## Music release API

This repo now includes a small internal REST + GraphQL API for music platform
posting. It targets the MarcsMusic platform set:

Audiomack, Audius, Bandcamp, BandLab, Drooble, HearThis, Hypeddit, Jamendo,
Linktree, N1M, Podomatic, ReverbNation, SoundClick, SoundCloud, and Spreaker.

- `GET /music/platforms`
- `GET /music/app`
- `GET /music/artists`
- `POST /music/artists`
- `POST /music/releases`
- `POST /music/releases/plan`
- `POST /music/releases/publish`
- `POST /music/releases/:releaseId/player-sync`
- `POST /music/releases/:releaseId/email-campaigns/preview`
- `POST /music/releases/:releaseId/email-campaigns/test`
- `POST /music/releases/:releaseId/email-campaigns/send`
- `POST /graphql`

Run it locally:

```bash
npm run music-api:start
```

Example dry-run publication batch:

```bash
curl -s http://127.0.0.1:8787/music/releases/publish \
  -H 'content-type: application/json' \
  -d '{
    "title": "Curacao",
    "artist": "Marc Rene",
    "audioSource": "s3://music/curacao.wav",
    "coverArtSource": "s3://music/curacao.jpg",
    "genre": "Pop",
    "tags": ["dutch", "pop"]
  }'
```

Real publication uses `dryRun=false` and requires `MUSIC_API_EXECUTION_TOKEN`
plus the matching `x-music-api-token` request header. The executable adapters
currently cover SoundCloud and Spreaker. Audius is modeled as exact SDK steps
but blocked for real execution until this repo uses a Node runtime compatible
with the current Audius SDK. Other requested platforms return explicit manual
workflow tasks.

See `docs/music-platform-api.md` for the API capability matrix and integration
roadmap.

The internal dashboard is available at `http://127.0.0.1:8787/music/app` when
the local API is running. Specs live in `docs/specs/`.
