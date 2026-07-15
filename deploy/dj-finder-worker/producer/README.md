# DJ Finder signed-source producer overlay

These standard-library Python files are an overlay for the existing
`dj-finder-cron` source tree. Copy the publisher, discovery wrapper, and
recovery command into that tree's `scripts/` directory. Railway cron must call
`run_global_dj_discovery_with_source_publish.py` directly. It is the sole
15-minute scheduler; do not nest the legacy 900-second loop inside Railway
cron. This preserves the immutable legacy source snapshot and makes every cron
execution terminate visibly.

This must run in the **same Railway service process** as discovery: Railway
volumes cannot be shared with a separate sidecar. The hook runs only after the
discovery command succeeds, reads `/data/dj_contacts.csv`, persists exact JSON
artifact bytes in `/data/dj_source_artifact_outbox.json`, and then posts them.
It never imports or invokes any email sender.

Required only when enabling:

```text
OUTREACH_SOURCE_PUBLISH_ENABLED=true
OUTREACH_SOURCE_INGESTION_BASE_URL=https://<outreach-worker>
OUTREACH_SOURCE_SIGNING_KEY_ID=dj-2026-07
OUTREACH_SOURCE_SIGNING_KEY=<unique 32+ character key>
DJ_OUTREACH_SOURCE_OUTBOX_PATH=/data/dj_source_artifact_outbox.json
OUTREACH_SOURCE_TIMEOUT_SECONDS=10
OUTREACH_SOURCE_MAX_ATTEMPTS=8
OUTREACH_SOURCE_MAX_REISSUES=3
OUTREACH_SOURCE_MAX_OPERATOR_RECOVERIES=3
# 23 hours; must remain below the worker's hard 24-hour acceptance limit.
OUTREACH_SOURCE_ENVELOPE_MAX_AGE_SECONDS=82800
```

The producer receives only the active v2 key id/key pair. Historical
verify-only keys stay on the outreach worker. Rotate consumer-first: add the old
active key to that source's `verifyOnly`, install a new active pair, then update
this producer. Unknown kids, v1 signatures, and cross-source keys are rejected.

Each semantic chunk has exactly one active envelope. Request attempts are
persisted before network I/O, exponentially backed off, and bounded. A stale
envelope is audited and re-issued with a new `artifactId` and `generatedAt`,
while its records and semantic digest remain unchanged. Exhausted or rejected
items enter `dead_letter` and are not silently retried.

Before that semantic digest is created, website, submission and evidence URLs
are canonicalized under the shared source URL v1 contract. Credentials,
fragments and unsafe encodings are rejected; only `utm_*`, `fbclid`, `gclid`
and `msclkid` query keys are removed. Functional token/signature parameters are
retained and sorted deterministically. The Python and Node implementations are
held to the same `docs/outreach/source-url-conformance-v1.json` fixtures. This
does not change the exact persisted bytes used for request signing and retries.

After investigating a dead letter, recover it explicitly in the same service
volume. Set `OUTREACH_SOURCE_RECOVERY_DIGEST`,
`OUTREACH_SOURCE_RECOVERY_OPERATOR`, and a 12–240 character
`OUTREACH_SOURCE_RECOVERY_REASON`, then run
`python scripts/recover_source_artifact.py`. Operator recoveries are audited and
bounded by `OUTREACH_SOURCE_MAX_OPERATOR_RECOVERIES`; never edit the JSON file
to force a replay.

Keep publishing disabled until the overlay is present in the actual DJ Finder
Git source and a staging canary succeeds. A public pull endpoint is not used.
The current non-Git-backed Railway base is a production NO-GO; see
`../supply-chain/SUPPLY_CHAIN.md`.
