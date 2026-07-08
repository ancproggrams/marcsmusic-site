# Railway Deployment Spec

The deployment target is the existing Railway project `marcsmusic-site`.

## Required Environment

- `MUSIC_API_EXECUTION_TOKEN`
- `MUSIC_UPLOAD_DIR`
- `MUSIC_MAX_AUDIO_BYTES`
- `MUSIC_MAX_ARTWORK_BYTES`
- `MUSIC_ALLOWED_AUDIO_TYPES`
- `MUSIC_ALLOWED_ARTWORK_TYPES`
- `ESPOCRM_BASE_URL`
- `ESPOCRM_API_KEY`
- `ESPOCRM_TIMEOUT_MS`
- `MARCSMUSIC_SITE_BASE_URL`
- `MARCSMUSIC_DOWNLOAD_BASE_URL`
- `MARCSMUSIC_PLAYER_MANIFEST_PATH`
- Existing Mailgun variables.

Use a Railway volume for uploaded audio/artwork and manifests. Do not rely on
ephemeral filesystem for production assets.

