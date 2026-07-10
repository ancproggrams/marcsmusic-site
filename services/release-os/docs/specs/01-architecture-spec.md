# Architecture Spec

## Layers

- Domain: platform capabilities, artists, releases, stable IDs.
- Application: orchestration for publication, uploads, player sync, contact
  segmentation and campaigns.
- Infrastructure: Mailgun, EspoCRM, storage, player manifest, platform adapters.
- Interfaces: REST, GraphQL and static HTML dashboard.

## Railway Findings

The local Railway CLI is linked to project `marcsmusic-site` in production. The
project contains online services for `marcsmusic-site`, `marcsmusic-crm`,
`music-submission-agent`, `marcsmusic-calendar`, MySQL and several cron jobs.
The release platform should be deployed as an existing or new service in that
project and should reuse Railway environment variables and volumes.

## Existing Player Findings

The current production site has a hardcoded `tracks` array in `public/index.html` using
MP3 URLs below `/soundcloud-growth-os/outreach-mp3/...`. The
`music-submission-agent` copy has direct download links under `assets/audio/*.mp3`
and `assets/audio/*.wav`. Its server can serve `/assets/audio/<file>` from
`AUDIO_ASSET_ROOT`, defaulting to `/data/audio` on Railway. This implementation
therefore creates stable `/assets/audio/<filename>` links and a sync manifest
that can be used to update the existing player without creating a second player.

## Module Boundaries

- `publication-service.mjs` orchestrates only; it must resolve adapters through
  registry and must not contain platform-specific branches.
- Platform-specific code lives under `src/infrastructure/music/platforms`.
- EspoCRM remains the source of truth for contacts; local state stores campaign
  attempt records only.
- Mailgun remains the only mail sender.
