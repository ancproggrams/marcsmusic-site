# ADR-004: Railway delivery, readiness, and rollback

Status: proposed

## Context

The calendar service currently deploys the website artifact, several services have no source SHA, and health endpoints do not prove dependency readiness.

## Decision

- Source-connect every service to GitHub with explicit root directory and `railway.json`.
- Keep calendar at `deploy/radicale` and EspoCRM at `deploy/espocrm` until approved app moves occur.
- Pin runtime major versions and image digests through reviewed dependency changes.
- Record and expose a minimal build SHA/version.
- Use isolated staging and production environments, credentials, data stores, and buckets.
- `/livez` checks only request processing; internal `/readyz` checks database/migration/storage and required dependencies with short, cached, read-only probes.
- Run authenticated CalDAV write/delete smoke only in staging with a unique test event and guaranteed cleanup.
- Use expand/contract migrations; destructive contract changes follow a compatible release.
- Maintain service runbooks for rollback, dependency outage, backup/restore, and credential rotation.

## Rollback

Rollback selects an exact successful SHA whose code remains compatible with the expanded schema. Redeploying a latest artifact alone is not a proven rollback. Production smoke, migrations, domains, secrets, and deployments require explicit human approval.

## Exit gates

Calendar logs show Radicale rather than the website; every deployment maps to repository/branch/SHA; readiness returns 503 on a required failure; staging rollback and database restore are exercised and recorded.
