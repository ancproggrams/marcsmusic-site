# MarcsMusic Music Submission Agent

Production-oriented MVP for discovering, verifying, prioritizing, queueing, monitoring, and exporting legitimate music submission opportunities. The service is isolated under `services/music-submission-agent/` and does not modify the existing MarcsMusic website.

## What It Does

- Seeds and deduplicates 20 requested discovery sources.
- Verifies public submission routes with robots.txt awareness and protected-workflow detection.
- Uses a durable SQLite queue with atomic claiming and crash recovery.
- Escalates CAPTCHA, login, payment, MFA, protected, or ambiguous workflows to `needs_manual_review`.
- Validates email addresses with an AfterShip `email-verifier` Go helper, with SMTP disabled by default.
- Generates CSV, XLSX, JSON, SQLite snapshots, analytics JSON, and a Markdown daily report.
- Exposes `/health`, `/api/health`, `/metrics`, `/queue`, `/platforms`, and `/analytics`.

## Local Development

```bash
npm install
npm run build
npm test
npm run lint
DATABASE_PATH=./data/submissions.sqlite EXPORT_DIR=./data/exports npm run run:once
DATABASE_PATH=./data/submissions.sqlite EXPORT_DIR=./data/exports npm start
```

Runtime defaults are Railway-first: `/data/submissions.sqlite` and `/data/exports`. Local development should override those paths as shown above.

## Environment Variables

| Variable                       | Default                        | Purpose                                                                                        |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`                | `/data/submissions.sqlite`     | SQLite database path on Railway persistent storage.                                            |
| `EXPORT_DIR`                   | `/data/exports`                | Export output directory on Railway persistent storage.                                         |
| `WORKER_MODE`                  | `all`                          | `all`, `api`, `worker`, `discovery`, `verification`, `submission`, or `exports`.               |
| `AUTO_SUBMIT_ENABLED`          | `false`                        | Required for automatic submissions. Keep false until browser executor and assets are approved. |
| `EMAIL_SMTP_VERIFY_ENABLED`    | `false`                        | Enables SMTP checks through AfterShip helper. Catch-all probing remains disabled.              |
| `AFTERSHIP_EMAIL_VERIFIER_BIN` | `bin/aftership-email-verifier` | Path to the AfterShip helper binary. Docker sets `/app/bin/aftership-email-verifier`.          |
| `MAX_BROWSER_CONCURRENCY`      | `1`                            | Capacity used for utilization metrics and future browser worker limits.                        |
| `DISCOVERY_INTERVAL`           | `1800000`                      | Discovery loop interval in milliseconds.                                                       |
| `VERIFICATION_INTERVAL`        | `3600000`                      | Verification loop interval in milliseconds.                                                    |
| `SUBMISSION_INTERVAL`          | `15000`                        | Submission loop interval in milliseconds.                                                      |

Required assets for automatic submission:

`ARTIST_NAME`, `ARTIST_EMAIL`, `TRACK_TITLE`, `TRACK_SPOTIFY_URL`, `TRACK_SOUNDCLOUD_URL`, `TRACK_MP3_URL`, `TRACK_WAV_URL`, `ARTWORK_URL`, `PRESS_PHOTO_URL`, `EPK_URL`, `ARTIST_BIO`.

## Queue Lifecycle

Queue states are:

`queued`, `running`, `waiting`, `retrying`, `completed`, `failed`, `cancelled`, `archived`, `needs_manual_review`.

Workers claim jobs atomically with SQLite `UPDATE ... RETURNING`, increment attempts on claim, and release jobs into retry states with exponential backoff and jitter for transient failures. Permanent or protected conditions do not retry.

## Safety Model

The service never bypasses CAPTCHA, login, MFA, anti-bot, payment, or authentication workflows. It does not guess email addresses and does not scrape private data. Protected routes are marked `needs_manual_review` with a reason and the worker moves on.

The current browser executor is `NoopBrowserExecutor`, which escalates active submission actions. `VercelAgentBrowserExecutor` exists as a future adapter boundary but is intentionally not configured in this MVP.

## Railway Deployment

Set the Railway root directory to:

```txt
services/music-submission-agent
```

Use the included `Dockerfile` and `railway.json`. Add a persistent volume mounted at `/data`, then set:

```env
DATABASE_PATH=/data/submissions.sqlite
EXPORT_DIR=/data/exports
WORKER_MODE=all
AUTO_SUBMIT_ENABLED=false
EMAIL_SMTP_VERIFY_ENABLED=false
```

Deploy health check: `/health`.
