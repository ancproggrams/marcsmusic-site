# Outreach signing-key rotation and rollback

This runbook covers unsubscribe-token and source-ingestion HMAC keys. It does
not cover data-encryption keys, EspoCRM/Mailgun webhook keys, or provider API
credentials. Never print Railway variables or record raw keys in logs, tickets,
screenshots, shell history, or Git. Rotation evidence contains only deployment
IDs, key IDs, timestamps, test results, and approvers.

## Invariants

- Every cryptographic purpose and every source uses independent random key
  material of 32–512 characters.
- Key IDs contain 1–32 safe characters and identify a generation; they are not
  secrets.
- Exactly one v2 key is active for signing. At most five older keys are
  verify-only. Unknown key IDs fail closed.
- Producers receive only their own active source key. They never receive worker
  historical keys or another source's key.
- Source v1 signatures are not accepted. Unsubscribe v1 is disabled by default.
- A v2 unsubscribe token cannot live longer than two UTC calendar years from
  its signed issuance time.

## Unsubscribe v2 rotation

The worker consumes one strict JSON value:

```text
OUTREACH_UNSUBSCRIBE_KEYRING_JSON={"schemaVersion":2,"active":{"kid":"unsub-2026-08","key":"<new-key>"},"verifyOnly":[{"kid":"unsub-2026-07","key":"<old-key>"}]}
```

1. Keep sending disabled. Generate a new independent key through the approved
   secret manager and record only its new `kid`.
2. In one reviewed Railway variable update, make the new pair `active` and move
   the previous active pair unchanged into `verifyOnly`. Do not remove any
   still-valid historical generation.
3. Restart/deploy the worker and verify startup, a newly issued v2 token, an
   overlap token signed by the previous key, unknown-kid rejection, and POST
   suppression/cancellation. Do not use a real recipient for the canary.
4. Retain an old verify-only key until the last token it signed has expired,
   bounded by its last issuance time plus two UTC calendar years. Then remove it
   in a separate reviewed change. Keep no more than five generations; shorten
   issuance lifetime before that limit could be exceeded.

Rollback before new tokens are issued is an atomic restoration of the previous
keyring. After new tokens exist, rollback must keep the new key in `verifyOnly`
while restoring the previous key as `active`; otherwise already issued tokens
break. Never roll back by reusing a key ID with different material.

### Temporary unsubscribe v1 bridge

Legacy verification requires both variables and is otherwise off:

```text
OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY=<independent-legacy-key>
OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_UNTIL=2026-08-01T00:00:00.000Z
```

The deadline must be exact ISO UTC and no more than two years ahead; the verifier
rejects v1 after it. Use the shortest approved migration window, monitor v1
verification, and remove both variables immediately after the last legacy token
expires. The legacy key must differ from every v2, hashing, encryption, webhook,
and source key. There is no v1 token generator.

## Source-ingestion v2 rotation

The worker's strict schema is:

```text
SOURCE_INGESTION_KEYRINGS_JSON={"schemaVersion":2,"sources":{"dj-finder":{"active":{"kid":"dj-2026-08","key":"<new-dj-key>"},"verifyOnly":[{"kid":"dj-2026-07","key":"<old-dj-key>"}]},"music-submission-agent":{"active":{"kid":"msa-2026-07","key":"<msa-key>"},"verifyOnly":[]},"marcsmusic-release-os":{"active":{"kid":"release-os-2026-07","key":"<release-key>"},"verifyOnly":[]}}}
```

Rotate one source at a time:

1. Keep ingestion available but sending disabled. Generate a new independent
   pair for the selected source.
2. Update the worker first: new pair becomes that source's `active`; previous
   pair moves to `verifyOnly`. Confirm the other source rings are byte-for-byte
   unchanged.
3. Verify worker startup and synthetic requests signed by both active and
   historical generations. Verify unknown kid, v1 downgrade, changed body, and
   cross-source signing all return authentication failures before nonce or CRM
   work.
4. Update only that producer's `OUTREACH_SOURCE_SIGNING_KEY_ID` and
   `OUTREACH_SOURCE_SIGNING_KEY`. Confirm its next durable outbox attempt sends
   `x-source-key-id` and a `v2=` signature while preserving exact artifact bytes.
5. Observe at least the producer's maximum retry/outbox age plus clock-skew
   window. When no persisted envelope can still use the old key, remove it from
   `verifyOnly` in a separate reviewed change.

Consumer-first ordering prevents an availability gap. If the producer update
fails, leave the worker overlap ring in place and restore the producer's old
active pair. If the worker update must be rolled back after the producer changed,
restore the old worker key as active but retain the new producer key as
verify-only, then roll the producer back. Never weaken signature version, source
binding, nonce replay, or exact-body verification during recovery.

## Required evidence

- approved change and rollback owner;
- affected service/source and old/new key IDs only;
- worker/producer deployment IDs and UTC cutover times;
- startup validation plus active/historical/unknown/downgrade/cross-source test
  results;
- first successful artifact/token generation using the new key ID;
- last observation window and reviewed removal time for the historical key;
- confirmation that no key value appeared in retained output.

