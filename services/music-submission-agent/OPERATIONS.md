# Operations Guide

## Runtime Overview

The service runs as one Railway-compatible container with SQLite persistence. `WORKER_MODE=all` starts API, discovery, verification, submission, and export loops. For split deployments, run separate services with `WORKER_MODE=api`, `verification`, `submission`, or `exports`.

## Manual Review Process

Review jobs where `status = needs_manual_review` in `/queue` or `submission_queue.sqlite`. Reasons include login, CAPTCHA, payment, robots.txt restrictions, protected browser flow, missing assets, or ambiguous publisher rules. Resolve manually before requeueing or archiving.

## Browser Adapter

Current executor: `NoopBrowserExecutor`.

Future executor: `VercelAgentBrowserExecutor`.

Rules for all executors:

- Stop immediately on CAPTCHA, login, MFA, payment, anti-bot, or manual approval.
- Store the reason in `manual_review_reason`.
- Do not continue attempting the protected workflow.
- Do not submit unless `AUTO_SUBMIT_ENABLED=true` and the full asset pack exists.

## Email Verification

Production Docker builds `tools/aftership-email-verifier`, a small Go CLI using `github.com/AfterShip/email-verifier`.

SMTP verification is disabled by default. If `EMAIL_SMTP_VERIFY_ENABLED=true`, the helper enables SMTP checks but disables catch-all probing because catch-all probing can generate random mailbox addresses, which is not allowed by the MarcsMusic safety policy.

Only supplied emails are verified. The service never guesses patterns such as `first@domain` or `demo@domain`.

## Exports

Exports regenerate after worker updates and during export loops:

- `verified_submission_platforms.csv`
- `verified_submission_platforms.xlsx`
- `verified_submission_platforms.json`
- `verified_submission_platforms.sqlite`
- `submission_queue.sqlite`
- `analytics_dashboard.json`
- `daily_report.md`

## Monitoring

Use:

- `/health` for container health.
- `/metrics` for Prometheus-style metrics.
- `/analytics` for JSON analytics.
- `/queue` for queue state and manual review backlog.
- `/platforms` for discovered and verified platform records.

Operational signals include queue backlog, running-job spikes, retry spikes, failed-job spikes, and export failures.

## Adding New Platforms

Add public, legitimate sources in `src/discovery/platformSeeds.ts` or implement a new discovery provider behind the discovery worker boundary. Mark known account-gated, paid, CAPTCHA, or manually curated routes as `manualReviewRequired` with a concrete reason.

## Adding New Exporters

Add exporters behind `ExportService.regenerate()`. Exporters must read from repositories, avoid duplicate business logic, and fail visibly through worker logs/events if generation breaks.

## Recovery

On startup, stale `running` jobs older than 15 minutes are recovered to `retrying` or `failed` based on attempt count. SQLite uses WAL mode and foreign keys. Use Railway persistent storage for `/data` or the queue/database will not survive redeploys.
