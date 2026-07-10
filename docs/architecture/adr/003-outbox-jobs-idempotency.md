# ADR-003: Outbox, jobs, idempotency, and leases

Status: proposed

## Context

Current process-local queues cannot survive restarts or replicas, and provider timeouts can cause duplicate payments, calendar changes, CRM writes, emails, or publications.

## Decision

- Use PostgreSQL as the initial durable job, webhook inbox, and outbox layer; do not add a broker yet.
- Commit aggregate changes and outbox records atomically.
- Claim jobs with `FOR UPDATE SKIP LOCKED`, a lease token, worker ID, lease expiry, and version.
- Require the same lease token/version for completion, retry, and failure; heartbeat long tasks.
- Enforce unique `(organization_id, operation, aggregate_id, idempotency_key)` keys.
- Persist provider request/response IDs, payload hash, state, and timestamps.
- Treat a post-send timeout as `outcome_unknown` and reconcile before retry.
- Use bounded exponential backoff with jitter, classified errors, maximum attempts, and an auditable DLQ.
- Guarantee ordering only per aggregate.

## Rejected for now

- In-memory locks as a distributed control.
- Automatic retry of ambiguous effects.
- Kafka, Redis, or another broker without measured PostgreSQL contention or throughput need.

## Exit gates

Duplicate/reordered webhook tests produce at most one effect; expired workers cannot complete reclaimed jobs; provider-timeout tests reconcile before retry; queue age, retries, unknown outcomes, DLQ, and worker freshness are observable.
