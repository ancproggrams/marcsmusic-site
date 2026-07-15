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
```

Direct Mailgun sends, including the smoke-test script and the historical
email-campaign `test`/`send` endpoints, are fail-closed unless
`LEGACY_OUTREACH_SEND_ENABLED` is exactly `true` in a non-production local
runtime. `NODE_ENV=production` or any Railway runtime marker forces it off even
when the flag is set; `services/outreach-worker` remains the production send
authority.

See `docs/mailgun.md` for configuration and operational notes.

## Signed outreach source

Release OS is a fact producer, never an outreach sender. When explicitly
enabled, each eligible release snapshot is staged in the same atomic JSON-store
commit as the release, then posted to
`/api/v1/source-ingestion/marcsmusic-release-os`. Retries preserve the exact
artifact bytes and rotate only the HMAC nonce/timestamp. Before the worker's
hard 24-hour age limit, an unacknowledged envelope is re-issued with a new
`artifactId` and `generatedAt`; its records and semantic digest remain exact.
Retries and automatic re-issues are persisted, exponentially backed off, and
bounded. Exhaustion enters `dead_letter` and never silently retries. Releases
without an ISRC, HTTPS evidence, evidence text, and an EPK or private stream
remain held.

All release and evidence URLs are canonicalized before the semantic digest is
created. The source URL v1 contract rejects credentials, fragments and unsafe
encodings; removes only `utm_*`, `fbclid`, `gclid` and `msclkid`; and preserves
functional token/signature parameters in deterministic order. Release OS, the
DJ Python producer and the worker share the conformance fixtures in
`docs/outreach/source-url-conformance-v1.json`. Transport HMACs and retries still
bind the exact persisted JSON bytes.

`OUTREACH_SOURCE_PUBLISH_ENABLED` defaults to `false`. Configure a unique
`OUTREACH_SOURCE_SIGNING_KEY_ID` and source-specific
`OUTREACH_SOURCE_SIGNING_KEY`; never reuse Mailgun, EspoCRM, execution,
unsubscribe, or another source's key. Requests use the v2 signature contract and
bind the source ID and key ID as well as timestamp, nonce, and exact body bytes.

Dead-letter recovery is an explicit audited operator action. After resolving
the cause, set `OUTREACH_SOURCE_RECOVERY_OPERATOR` and a 12–240 character
`OUTREACH_SOURCE_RECOVERY_REASON`, then run `npm run outreach-source:recover`.
Recovery is itself capped by `OUTREACH_SOURCE_MAX_OPERATOR_RECOVERIES`; never
edit or delete the outbox to force a replay.

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
- `GET /music/publications/:id`
- `POST /music/publications/:id/reconcile`
- `POST /music/publications/reconcile-stale`
- `GET /music/assets/:assetId/signed-url`
- `POST /music/assets/cleanup`
- `POST /music/releases/:releaseId/player-sync`
- `POST /music/releases/:releaseId/email-campaigns/preview`
- `POST /music/releases/:releaseId/email-campaigns/test`
- `POST /music/releases/:releaseId/email-campaigns/send`
- `POST /graphql`

Run it locally:

```bash
npm run music-api:start
```

Every `/music/*` route and `/graphql` requires strong HTTP Basic credentials in
`MUSIC_API_ADMIN_USERNAME` (1–256 bytes) and `MUSIC_API_ADMIN_PASSWORD` (32–256
bytes). Missing or weak server credentials fail closed with `503`; incorrect
request credentials return `401`. Only `/livez` and the minimal `/health` are
public. Audio and artwork require either valid administrator Basic credentials
or a short-lived `MUSIC_ASSET_SIGNING_KEY` HMAC URL; invalid requests are
concealed as `404` and successful responses are `private, no-store`. Player
sync fails closed when signing is unavailable. Never store real credentials in
this repository. Because manifests contain expiring URLs, schedule player sync
before `MUSIC_ASSET_URL_TTL_SECONDS` elapses.

Example dry-run publication batch:

```bash
curl -s -u "$MUSIC_API_ADMIN_USERNAME:$MUSIC_API_ADMIN_PASSWORD" \
  http://127.0.0.1:8787/music/releases/publish \
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

Real publication uses `dryRun=false` and requires HTTP Basic auth plus
`MUSIC_API_EXECUTION_TOKEN` and the matching `x-music-api-token` request header.
Executable publication accepts only application-managed audio beneath
`MUSIC_UPLOAD_DIR`. `file:` URLs, paths outside that root and symlink escapes
are rejected. Allow-listed HTTPS media is available only for non-production
development; it is unconditionally disabled on Railway and under
`NODE_ENV=production`, avoiding DNS-based private-network fetch ambiguity.
Provider requests retain their deadline through response consumption and cap
response bytes.

Every real release/platform action is staged in `publicationOutbox` before
provider I/O. An atomic lease plus monotonic fence prevents concurrent duplicate
execution. The normalized payload digest is bound to the stable idempotency key;
a changed payload returns `409`. Successes and attempt history are persisted
before the API returns. An expired lease, timeout, transport failure, or other
unprovable provider outcome enters `reconciliation_required` and is never
automatically retried. An authorized operator must record `submitted`,
`failed`, or `not_submitted`; only a confirmed `not_submitted` outcome permits
the next explicit publication request to execute again.

Release creation compensates files if validation or the state commit fails.
`POST /music/assets/cleanup` requires Basic auth plus the execution token and
deletes only old, unreferenced regular files within caller-bounded scan/delete
limits. It does not follow symlinks.

JSON state and player-manifest mutations use one cross-process lease protocol:
exclusive lock creation, heartbeat, process-instance fencing, PID+UUID temp
files, fsync and atomic rename. It coordinates only processes that see the same
filesystem path. Keep the file-backed service to one shared-volume writer
replica; horizontal replicas with isolated files require migration to a
transactional shared database/object store rather than longer lock settings.
The executable adapters
currently cover SoundCloud and Spreaker. Audius is modeled as exact SDK steps
but blocked for real execution until this repo uses a Node runtime compatible
with the current Audius SDK. Other requested platforms return explicit manual
workflow tasks.

See `docs/music-platform-api.md` for the API capability matrix and integration
roadmap.

The internal dashboard is available at `http://127.0.0.1:8787/music/app` when
the local API is running. Specs live in `docs/specs/`.
