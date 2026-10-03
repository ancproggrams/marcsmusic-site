# ADR-001: PostgreSQL and object storage

Status: proposed

## Context

The website and Release OS rewrite complete JSON state, while media lives in Git or local volumes. This prevents safe concurrency, replicas, targeted retention, and proven recovery.

## Decision

- Use one managed PostgreSQL cluster per environment initially, isolated by schemas, roles, and one writer owner per table.
- Require keys, foreign keys, unique constraints, timestamps, and versions where optimistic locking is needed.
- Model active booking overlap with a PostgreSQL range/exclusion constraint.
- Store webhook inbox and outbox records in the same transaction as aggregate changes.
- Store audio, artwork, and report artifacts in S3-compatible object storage using server-generated UUID/checksum keys.
- Keep checksums, size, media type, object ID, and ownership in SQL.
- Require backups, PITR configuration, and a restore drill before production cutover.

## Rejected for now

- JSON or SQLite for multi-instance core state.
- A database cluster per application.
- A distributed database or permanent dual-write architecture.

## Migration and rollback

Use expand, reconcile, verify, switch, then contract. Create an immutable source export with checksums. After cutover PostgreSQL is the only writer. A rollback after new writes requires maintenance and database restoration/reconciliation; it must not restore a stale JSON copy.
