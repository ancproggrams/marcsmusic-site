# MarcsMusic Music Submission Agent

Railway-ready service container for discovering, verifying, enriching, deduplicating and queueing legitimate global music submission opportunities.

## Safety rules

- Use only public and authorized submission routes.
- Do not bypass login, payment, anti-bot controls or publisher restrictions.
- Escalate protected, paid or ambiguous flows to manual review.
- Do not store guessed contact addresses.
- Store business contacts only after verification.

## Runtime components

- Discovery worker: finds candidate platforms.
- Verification worker: checks activity, genre fit and submission route quality.
- Submission queue: durable SQLite-backed queue for Railway.
- Submission worker: processes safe queued form routes when approved assets are present.
- Analytics worker: exports CSV, JSON, SQLite-derived dashboard data and a daily report.

## Railway deployment

Create a Railway service from this folder and set these variables:

```env
DATABASE_PATH=/data/submissions.sqlite
EXPORT_DIR=/data/exports
WORKER_MODE=all
AUTO_SUBMIT_ENABLED=false
ARTIST_NAME=MarcsMusic
ARTIST_EMAIL=marc@marcsmusic.nl
TRACK_TITLE=
TRACK_SPOTIFY_URL=
TRACK_SOUNDCLOUD_URL=
TRACK_MP3_URL=
TRACK_WAV_URL=
ARTWORK_URL=
EPK_URL=
```

Keep `AUTO_SUBMIT_ENABLED=false` until the Vercel Agent Browser integration and approved asset pack are connected.

## Commands

```bash
npm install
npm run build
npm run start
```
