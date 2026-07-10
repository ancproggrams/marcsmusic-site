# MarcsMusic Player Sync

The existing production player is in `public/index.html` as a hardcoded
track array. The submission-agent copy also exposes direct `assets/audio/*.mp3`
and `assets/audio/*.wav` links and serves `/assets/audio/<file>` from
`AUDIO_ASSET_ROOT`.

This service creates:

- stable `/assets/audio/<file>` MP3/WAV links
- `/assets/artwork/<file>` artwork links
- an idempotent player manifest at `MARCSMUSIC_PLAYER_MANIFEST_PATH`

The manifest is intentionally a sync artifact. Updating the production
`public/index.html` player should be done through an explicit deployment workflow so
existing Marc Rene links are not broken.
