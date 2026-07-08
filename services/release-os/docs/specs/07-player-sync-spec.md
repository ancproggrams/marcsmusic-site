# Player Sync Spec

New tracks must be syncable to the existing `marcsmusic.nl` player and direct
download pattern.

## Output

- Player manifest entry.
- MP3 direct download URL when MP3 asset exists.
- WAV direct download URL when WAV asset exists.
- Artwork URL when artwork exists.
- Artist metadata.

## Idempotency

Syncing the same release twice updates the existing manifest entry rather than
duplicating it.

