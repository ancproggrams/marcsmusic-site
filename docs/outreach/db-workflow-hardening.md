# Database and reconciliation safety contract

This contract covers durable event failure state, bounded PostgreSQL waits, EspoCRM traversal and reconciliation ownership. It is an implementation control and operating aid; it is not evidence of ISO/IEC 27001 certification or legal compliance by itself.

## Event inbox and work failure

Webhook ingress writes the encrypted inbox row and its work item in one transaction. A fenced work failure updates both rows in one transaction using the work lease owner and generation. Retryable failures retain the same bounded backoff and error code; permanent errors or the fifth attempt move both records to `dead_letter`. A stale worker cannot overwrite either lifecycle. Payloads, stack traces and recipient data are not copied into error columns.

Operators should treat a `dead_letter` inbox row as poisoned or permanently invalid input. Preserve the encrypted source event, investigate the allow-listed error code, and create a new explicitly reviewed replay identity rather than editing attempts or status in place.

## PostgreSQL wait budget

Every worker pool has bounded connection acquisition, query, statement, row-lock and idle-in-transaction waits. Session and transaction advisory locks are acquired with `pg_try_advisory_*` polling until `DATABASE_ADVISORY_LOCK_TIMEOUT_MS`; timeout is retryable and releases any earlier multi-key locks in reverse order.

Default limits:

| Control | Default | Configuration bound |
| --- | ---: | ---: |
| statement execution | 15 s | 250 ms–60 s |
| client query | 20 s | 500 ms–65 s |
| row/table lock | 2 s | 50 ms–10 s |
| idle transaction | 20 s | 1–60 s |
| advisory-lock acquisition | 5 s | 50 ms–30 s |

Keep the client query timeout at least as large as the server statement timeout. Increasing any bound is a capacity/reliability change: record the blocked operation, pool saturation and downstream SLO impact first. Never replace try-lock acquisition with an unbounded advisory lock.

## EspoCRM cursor contract

List iteration captures one immutable upper `modifiedAt` watermark and advances by `(modifiedAt,id)`. EspoCRM's standard API accepts only one order attribute, so the client handles equal timestamps explicitly:

1. read the range ordered by `modifiedAt`;
2. accept only timestamp groups proven complete before the page boundary;
3. re-read the boundary timestamp ordered by `id` with `id > cursor.id`;
4. persist the last pair only after the corresponding work batch is durably enqueued.

No iterating request uses a numeric offset. The client always selects `id` and `modifiedAt`, rejects a non-advancing tuple, duplicate tuple, missing cursor field and results above the configured bound. A record updated beyond the fixed upper watermark is intentionally deferred to the next overlapping incremental run.

## Reconciliation lease and recovery

`workflow_leases` is the authoritative singleton and checkpoint for each incremental or full reconciliation. Acquisition holds a row lock, increments `fence_token`, creates a `workflow_runs` attempt and sets a finite lease. Heartbeats and every checkpoint match all of `lease_name`, `owner_id`, `fence_token` and `run_id`. An expired owner may be replaced; its late checkpoint, completion and watermark update are rejected.

The checkpoint stores:

- fixed lower and upper watermarks;
- current entity-route index;
- last `(modifiedAt,id)` tuple;
- cumulative per-entity counters;
- run and fence identities.

On retry, the worker resumes the incomplete fixed scope rather than adopting a later upper watermark. Queue dedupe keys make a crash between batch insert and checkpoint safe to replay. Successful completion clears ownership and updates the business watermark and workflow result in one PostgreSQL transaction. Failure releases ownership but retains the checkpoint.

Do not edit `workflow_leases`, `workflow_runs` or `watermarks` manually. To recover, leave sending disabled, correct the dependency, let the failed work item reacquire the lease, and verify that the next run reports `resumed=true` and reaches `succeeded`.

## Remaining scaling boundaries

- A full reconciliation remains O(N) in CRM records, although only one replica can run it and it is restartable. At sustained multi-million-record scale, replace daily global traversal with a CRM change feed plus rate-budgeted deterministic shards.
- The hard fail-closed ceiling is 10,000,000 records per entity per scope. Raising it requires a reviewed capacity test; it is not a pagination mechanism.
- Equal-timestamp boundary repair adds CRM requests. Very coarse `modifiedAt` precision or bulk imports with huge timestamp groups increase read amplification.
- PostgreSQL fencing prevents overlapping owners but does not cancel an HTTP request already in flight. Any batch enqueued by a just-fenced worker is harmless only because work dedupe is mandatory.
