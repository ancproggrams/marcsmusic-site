# EspoCRM projection and Target List contract

This document defines the production boundary between PostgreSQL execution state and EspoCRM business records. It is implementation evidence, not an ISO certification, legal opinion or proof that the control operates in production.

## Ownership and delivery receipt

PostgreSQL owns queue, attempt, idempotency and delivery-acceptance state. EspoCRM owns the human-visible Campaign, Target List, Email, OutreachEvent, contact preference and Opportunity projections. A Mailgun acceptance and the durable `sync_delivery_to_crm` work item are committed in one PostgreSQL transaction. A crash may replay the projection but cannot legitimately create a second receipt.

Every confirmed send uses deterministic keys:

- Campaign and Target List: `music-release:<musicReleaseId>`;
- Email: `send:<sendQueueId>`;
- sent OutreachEvent: `sent:<sendQueueId>`;
- Opportunity: `match:<outreachMatchId>`.

Unique MySQL indexes are the final identity fence. `Email` and `OutreachEvent` are immutable receipts: an existing key with different content is a permanent projection-integrity error, not an update. Provider identifiers, deterministic message ID, correlation ID, accepted time, exact recipient/sender, template version and prompt version come from the accepted PostgreSQL receipt and immutable copy artifact.

## Target List membership

There is exactly one managed Target List and one managed Campaign per MusicRelease. The custom relation is a real EspoCRM many-to-many relation:

```text
MusicRelease 1 ── 1 TargetList 1 ── * MediaContact
       │                 │
       └── 1 Campaign ───┘
```

The worker may write only `TargetList.mediaContacts` and `Campaign.targetLists`; arbitrary entity or relation names are rejected before an HTTP request. A relationship write is preceded and followed by an exact read. A timeout or conflict succeeds only when read-after-write proves the requested relation exists.

Immediately before a confirmed delivery is added to the Target List, the worker reloads the current release, contact and outlet and applies the same deterministic eligibility gate used before sending. Suppression and persisted rejected-genre state are checked again. `activeSequence` is deliberately not a blocker for this projection because the accepted delivery itself belongs to that active sequence. An ineligible contact still receives the immutable Email/Event receipt for a send that already occurred, but is not added as an eligible Campaign target.

`Campaign.targetMembershipCount` is reconciled from EspoCRM's exact relationship total under optimistic concurrency control. Concurrent first deliveries converge on one Campaign, one Target List and the complete unique membership set. Projection timestamps only move forward, and the reason code corresponds to the latest persisted projection time. Managed Campaign/Target List identity cannot be changed or deleted by a normal record save; a legacy Campaign may receive its Target List exactly once during upgrade.

Route B remains authoritative for sending: membership is reporting and grouping evidence, not authorization for EspoCRM Mass Email. No Mass Email job may send from this Target List.

## Replies and commercial signals

Positive current-release replies create one Opportunity per OutreachMatch. The first source event and all identity links are immutable. A later stronger reply may advance only the interest status, time and latest-event link. Amount, probability and close date are never invented; human-entered revenue remains untouched.

`Future Releases` records a preference and genre set but does not manufacture opt-in, lawful basis or an Opportunity. `Not Suitable` appends a deny-wins PostgreSQL genre denial and projects the canonical union to MediaContact under a contact fence. Ambiguous and provider-uncertain outcomes remain review/reconciliation work and never become a fabricated Sent Email.

## Time and replay invariants

Immutable event time is provider time when valid, otherwise the persisted inbox `created_at`. Delivery projections use the persisted provider-acceptance time. Reply projection uses the already stored OutreachEvent time. Wall-clock time is not used to reconstruct an immutable CRM receipt after a crash.

All mutable CRM transitions use `versionNumber`. A `409` causes a fresh read and bounded retry. An ambiguous create/update is accepted only after a postcondition read; otherwise the work remains retryable or is dead-lettered according to the existing bounded work policy.

## MusicRelease identity and activation

ISRC is canonicalized to uppercase without hyphens and protected by a database-wide unique index, including soft-deleted rows. Source ingestion uses evidence timestamp plus digest and bounded optimistic retries so concurrent same-ISRC creates converge on the newest verified source revision; equal-time conflicting revisions fail closed.

A new MusicRelease must start `Unverified` without self-asserted EPK proof. Activation requires `epkAttestationState=Verified`, a lowercase SHA-256 manifest digest, an exact UTC verification time, a bounded evidence reference and a public absolute HTTPS EPK URL. A change to any field covered by the EPK manifest invalidates the proof, clears its evidence and moves `Active` to `Paused` or `Ready` to `Draft`. Verification therefore always reads the CRM version, verifies the remote public EPK and assets, compares all modeled fields, then performs an OCC update; a conflict requires a complete re-fetch and re-verification.

## API identity permission boundary

The autonomous worker must use a dedicated EspoCRM API user, never an administrator or a human login. Its reviewed role needs global read only for the business sets it actually scans or aggregates (`MusicRelease`, `MediaOutlet`, `MediaContact`, `OutreachMatch` and `OutreachDailyReport`). Create/update access is limited to the modeled projection entities and their two allow-listed relationships. Delete, Entity Manager, extension administration, user/role administration, Mass Email and unrelated standard CRM scopes are denied. Legacy Lead/CampaignLogRecord migration uses a separate temporary read identity and is removed after the approved migration.

`Email:create` is an exceptional permission: the worker needs it to register a managed record whose status is already `Sent`. EspoCRM's core Email service can also transport a record whose status is `Sending`. The worker identity must therefore have no personal or group SMTP account, no outbound-email/send permission and no Mass Email capability. Staging evidence must attempt the core send path and prove that it is denied while a managed `Sent` receipt still succeeds. A role screenshot or generic “API user” label is not sufficient evidence; retain the exported grants, account ownership, negative send test, credential owner, revocation test and review approval for the exact deployment.

## Operations and evidence

Before enabling production sending, retain evidence for:

1. extension package build and PHP/JSON validation;
2. disposable pinned EspoCRM/MySQL install and schema assertion;
3. duplicate relationship replay, entry count and Campaign relation checks;
4. concurrent ISRC creation and stale-OCC rejection;
5. activation rejection without proof, successful verified activation and automatic invalidation after a protected change;
6. PostgreSQL integration tests for atomic acceptance/projection work and replay;
7. least-privilege API-user grants and confirmation that no Espo Mass Email process uses the reporting Target List;
8. alerting for projection backlog, permanent identity mismatch, relationship postcondition failure and Campaign count drift.

The repository verifier currently exercises this boundary through 153 live HTTP requests on the pinned disposable image: all 11 unique-create services, all 10 immutable service boundaries, three relationship contracts, 20 rejected state changes, eight accepted updates, aggregate accuracy, restricted-role denial, classmaps and required indexes. This is worktree evidence only; the identical frozen artifact still requires restored-staging execution and retained deployment evidence.

If the Target List adapter or activation hook cannot be proven against the pinned EspoCRM version, keep sending disabled. Do not replace a failed relationship proof with an assumed Campaign count or a human-authored `Verified` flag.
