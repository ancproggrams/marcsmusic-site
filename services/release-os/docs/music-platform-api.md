# MarcsMusic Music Platform API

## Goal

Create one internal API that manages new music posting across MarcsMusic
platform accounts without pretending every platform has a safe public upload
API.

The current implementation is a release control plane:

- REST: `GET /music/platforms`, `POST /music/releases/plan`,
  `POST /music/releases/publish`
- GraphQL: `planRelease` and `publishRelease` mutations through `POST /graphql`
- Capability registry: `src/domain/music/platform-capabilities.mjs`
- Adapter registry: `src/domain/music/platform-registry.mjs`
- Release planner: `src/application/music/release-planner.mjs`
- Stateless adapter orchestrator: `src/application/music/publication-service.mjs`
- Durable execution boundary: `src/application/music/durable-publication-service.mjs`
- Provider/manual adapters: `src/infrastructure/music/platforms/*.mjs`

It deliberately does not use stored passwords to drive browser automation.
Adapters should only execute against official APIs or explicitly approved
manual workflows.

## Default Release Targets

`POST /music/releases/publish` defaults to exactly these 15 MarcsMusic release
targets:

Audiomack, Audius, Bandcamp, BandLab, Drooble, HearThis, Hypeddit, Jamendo,
Linktree, N1M, Podomatic, ReverbNation, SoundClick, SoundCloud, and Spreaker.

Dry-run is the default. Real execution requires:

- request body: `"dryRun": false`
- environment: `MUSIC_API_EXECUTION_TOKEN`
- request header: `x-music-api-token: <same token>`
- provider credentials for the selected executable adapter

Real requests first persist a release/platform intent and payload digest. A
lease and monotonic fence permit at most one active provider call. Completed
successful and terminal results replay from the outbox. Provider-free blocked
preconditions can be retried only by a new explicit request. Expired leases and
uncertain provider outcomes enter `reconciliation_required`; they do not
auto-retry. Operators use
`POST /music/publications/:id/reconcile` with `submitted`, `failed`, or
`not_submitted` evidence. Only `not_submitted` makes the record claimable again.

## Platform Capability Matrix

| Platform | Railway env seen | Posting status | API path |
| --- | --- | --- | --- |
| SoundCloud | Yes | Executable adapter | Official API supports OAuth and multipart `POST /tracks`. |
| Spreaker | Yes | Executable adapter | Official API supports episode upload to `POST /v2/shows/SHOW-ID/episodes`. |
| Audius | Yes | Dry-run SDK plan only | Official SDK supports uploads, but current `@audius/sdk` requires Node >=22 while this repo supports Node >=20.12. |
| Jamendo | Yes | Research/contract check | Developer portal has read-only and read/write API plans; confirm release upload semantics first. |
| Audiomack | Yes | Data/social API only until proven otherwise | Data API exposes catalog, playlists, favorites, reposts, follows, and user uploads reads. |
| Bandcamp | Yes | Restricted partner API | Official API is for labels and merchandise fulfillment partners; public docs do not expose track upload. |
| BandLab, Drooble, HearThis, Hypeddit, Linktree, N1M, Podomatic, ReverbNation, SoundClick | Yes | Manual workflow | No current official public upload API was confirmed. |
| Spotify, Apple Music, Deezer, Tidal, Amazon Music, Qobuz | No | Distributor delivery | Treat as DSP destinations through distributor/label delivery, not this direct-posting target list. |

The capability registry still knows about some extra observed or future
platforms such as Mixcloud, YouTube, Fandalism, and Vowave, but the default
publication target list is the 15-platform set above.

## Recommended Architecture

Use this gateway as the control plane:

1. Store one release object with canonical metadata, audio source, artwork,
   rights flags, explicit/AI-generated flags, and target platforms.
2. Generate a release plan with idempotency keys per platform.
3. Execute only official API adapters automatically, behind the
   `MUSIC_API_EXECUTION_TOKEN` gate.
4. Create manual tasks for platforms without confirmed APIs.
5. Send Spotify, Apple Music, Deezer, Tidal, Amazon Music, and Qobuz through a
   distributor path instead of direct API upload.
6. Keep every platform attempt, result, fence, external URL, and operator
   reconciliation in the durable publication outbox.

## Add A Platform

1. Add or update the platform capability in
   `src/domain/music/platform-capabilities.mjs`.
2. Create `src/infrastructure/music/platforms/<platform>.mjs` exporting an
   adapter with `{ capability, publish(...) }`.
3. Register the adapter in `src/infrastructure/music/platforms/index.mjs`.
4. Add tests for registry lookup, dry-run behavior, credential handling and
   manual-task fallback.
5. Run `npm run verify`.

## REST Examples

Create a dry-run batch for the default 15 targets:

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

Execute only SoundCloud for a local file:

```bash
curl -s -u "$MUSIC_API_ADMIN_USERNAME:$MUSIC_API_ADMIN_PASSWORD" \
  http://127.0.0.1:8787/music/releases/publish \
  -H 'content-type: application/json' \
  -H "x-music-api-token: $MUSIC_API_EXECUTION_TOKEN" \
  -d '{
    "title": "Curacao",
    "artist": "Marc Rene",
    "audioSource": "/absolute/MUSIC_UPLOAD_DIR/audio/curacao.mp3",
    "description": "Radio edit",
    "genre": "Pop",
    "tags": ["dutch", "pop"],
    "targetPlatforms": ["soundcloud"],
    "dryRun": false
  }'
```

Executable uploads accept only canonical local files below `MUSIC_UPLOAD_DIR`.
`file:` URLs, outside paths, and symlink escapes are rejected. Explicitly
allow-listed HTTPS media is a non-production development feature and is always
disabled on Railway and under `NODE_ENV=production`.

## GraphQL Examples

List automatic API candidates:

```graphql
query {
  platforms(autoPostOnly: true) {
    id
    name
    uploadSupport
    requiredCredentialEnv
  }
}
```

Publish a dry-run batch:

```graphql
mutation {
  publishRelease(input: {
    title: "Curacao"
    artist: "Marc Rene"
    audioSource: "s3://music/curacao.wav"
    targetPlatforms: ["soundcloud", "spreaker", "audius", "bandcamp", "linktree"]
  }) {
    summary {
      dryRun
      manualTask
      blocked
    }
    results {
      platformId
      status
      message
      manualTask {
        kind
        url
      }
    }
  }
}
```

## Adapter Roadmap

1. Migrate the file-backed outbox to a transactional shared database before
   horizontally scaling Release OS beyond one shared-volume writer.
2. SoundCloud hardening: metadata update, provider-side duplicate
   detection, and track URL verification.
3. Spreaker hardening: show lookup, scheduled publish support, duplicate
   detection, and episode URL verification.
4. Audius adapter: isolate a Node >=22 worker or raise the repo runtime, then
   wire SDK user authorization and track upload.
5. Mixcloud adapter: access-token storage, multipart upload, tag validation.
6. YouTube adapter: OAuth refresh token, resumable upload, private/unlisted
   default, quota handling.
7. Distributor package export: DDEX-style metadata package or CSV/asset bundle
   for Spotify/Apple/Deezer/Tidal delivery through a distributor.

## Production Guardrails

- Keep provider tokens out of browser code and logs.
- Use idempotency keys per release/platform before every upload attempt.
- Default first uploads to private, unlisted, or draft where the provider
  supports it.
- Do not retry unknown upload failures blindly; verify provider state first.
- Record external platform IDs/URLs immediately after success.
- Keep manual workflows explicit for platforms without official APIs.
- Never log provider access tokens or platform account passwords.

## Primary API References

- SoundCloud API guide: https://developers.soundcloud.com/docs/api/guide
- Audius SDK uploads: https://docs.audius.co/sdk/uploads
- Audius SDK tracks: https://docs.audius.co/sdk/tracks
- Spreaker episodes API: https://developers.spreaker.com/api/episodes/
- Bandcamp developer API: https://bandcamp.com/developer
- Jamendo developer portal: https://devportal.jamendo.com/
- Linktree developer program: https://linktr.ee/marketplace/developer
