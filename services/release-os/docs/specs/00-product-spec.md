# MarcsMusic Release OS Product Spec

## Objective

Build an internal release-management platform for MarcsMusic that runs on Railway
inside the existing `marcsmusic-site` project. The platform manages multiple
artists, uploads release assets, plans/publishes to music platforms, syncs tracks
to the existing `marcsmusic.nl` player/download pattern, and sends multilingual
new-music campaigns through Mailgun to contacts sourced from EspoCRM.

## Complete Execution Prompt

You are a senior product engineer, architect, reliability engineer and security
reviewer. Build this project via Spec Driven Development. Keep inspecting,
specifying, testing, building and validating until the acceptance checklist is
green. Do not build a new CRM, a new mail system or a parallel music player.
Railway is the deployment target, Mailgun is the mail provider, EspoCRM is the
contact source of truth, and the existing `marcsmusic.nl` player/download
patterns must be reused.

## In Scope

- Multi-artist management with Marc Rene as default/backward-compatible artist.
- Release upload from an internal HTML dashboard.
- Artwork upload: JPG, PNG, WEBP.
- Audio upload: MP3 and WAV.
- Modular platform adapter registry for the 15 requested music platforms.
- SoundCloud and Spreaker official API adapters.
- Audius dry-run/blocked SDK plan until Node >=22 or isolated worker exists.
- Jamendo research/contract-check workflow.
- Manual tasks for platforms without confirmed public upload APIs.
- Player sync manifest and direct download links following existing site patterns.
- EspoCRM contact segmentation.
- Mailgun new-music preview, test send and guarded campaign send.
- Railway/env/deployment documentation.

## Out of Scope

- Password-based browser automation for music platforms.
- New CRM/contact database.
- New mail delivery provider.
- Replacing the production `marcsmusic.nl` player without a separate migration.
- Real campaign send or platform publication without execution guard.

