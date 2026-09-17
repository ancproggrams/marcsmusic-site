# Outreach source-of-truth contract

This contract prevents two systems from independently “winning” the same field. Every state has one authoritative owner; other copies are projections, caches or evidence. If a projection disagrees with its owner, reconciliation repairs the projection and records the discrepancy.

The two design briefs use “source of truth” at different levels. The implemented contract resolves that deliberately:

- **EspoCRM is authoritative for business state:** releases, outlets, contacts, eligibility presentation, campaign state, suppressions and the human-visible audit trail.
- **PostgreSQL is authoritative for technical execution state:** leases, inbox replay identity, allocations, queues, delivery attempts, capacity reservations, circuit state and watermarks.
- The worker is an orchestrator, not a third database of record. Process memory is disposable, and Mailgun owns only transport outcomes.

Neither EspoCRM nor PostgreSQL may infer that absence in the other system grants permission. A denial, suppression or terminal business state always wins.

## Ownership matrix

| Data or decision | Authoritative owner | Derived copy / transport | Conflict rule |
| --- | --- | --- | --- |
| Release identity, assets, campaign status, campaign window and send limit | EspoCRM `MusicRelease` | Worker read model during a job | EspoCRM wins. A paused/inactive release blocks sends immediately. |
| Release EPK verification and activation evidence | EspoCRM `MusicRelease` proof fields backed by the public EPK manifest | EPK verifier performs bounded remote reads and an OCC projection | A new release is unverified. Any manifest-covered CRM change invalidates the proof server-side; `Active` requires a verified digest/evidence tuple. |
| Outlet identity, format, territory, submission policy and validation evidence | EspoCRM `MediaOutlet` | Worker normalization during matching/sending | EspoCRM wins. `No Submissions`, inactive or email-disabled denies. |
| Contact identity, email, purpose, contact basis, evidence, validation and do-not-contact flags | EspoCRM `MediaContact` | Encrypted job payload where strictly needed | EspoCRM wins. The worker reloads before each send. |
| Release/contact score, reasons, eligibility and campaign presentation | EspoCRM `OutreachMatch` | PostgreSQL rows reference its ID | Deterministic policy recomputes; EspoCRM stores the business-visible result. Manual terminal/deny state wins over queued work. |
| Human-visible outreach and outcome history | EspoCRM `OutreachEvent` | PostgreSQL `outcome_events` and encrypted inbox | Provider event is first made durable, then idempotently projected into EspoCRM. |
| Business suppression record and evidence | EspoCRM `OutreachSuppression` | PostgreSQL `suppression_cache` stores keyed hashes | **Deny wins.** Either active source blocks. Reconciliation adds missing denies; it never auto-removes one. |
| Daily business report | EspoCRM `OutreachDailyReport` | PostgreSQL aggregate query | PostgreSQL events compute it; EspoCRM is the retained business report. Re-running the date is an idempotent upsert. |
| Campaign grouping and eligible delivered-target membership | EspoCRM `Campaign`, `TargetList` and their relationship table | PostgreSQL delivery receipt triggers idempotent projection work | One deterministic Campaign/Target List exists per release. Membership is added only after current deterministic eligibility; Route B remains the only sender. |
| Webhook ingress and replay identity | PostgreSQL `encrypted_event_inbox` | Provider retry | PostgreSQL unique `(source, external_id)` wins. Duplicate delivery acknowledges without duplicate work. |
| Work execution, leases and retry count | PostgreSQL `work_items` | Worker memory for one lease only | PostgreSQL wins. Memory state is disposable. |
| Generated/template copy artifact | PostgreSQL `copy_artifacts` | Mailgun message; EspoCRM stores metadata only | Immutable encrypted artifact selected by hash. Invalid AI copy is discarded in favor of safe template. |
| Active sequence allocation and cooldown | PostgreSQL `sequence_allocations` | EspoCRM `activeSequence`, `cooldownUntil` and campaign presentation | PostgreSQL serializes active ownership across replicas; EspoCRM denial/terminal state can only cancel it. A released allocation retains its cooldown evidence. |
| Send scheduling and idempotency | PostgreSQL `send_queue` | EspoCRM campaign presentation | PostgreSQL unique release/contact/step and deterministic message ID win. Only step `0` is queued at allocation; a later step is created only after provider acceptance of its predecessor. |
| Provider request attempt and uncertain delivery | PostgreSQL `delivery_attempts` | Mailgun response/event | Every attempt is append-only. `delivery_unknown` requires reconciliation, never blind resend. |
| Automatic response scheduling and attempt | PostgreSQL response queue/attempt tables | Mailgun response message | Same idempotency and uncertainty rules as initial outreach. |
| Daily global/domain capacity | PostgreSQL `send_counters` | Metrics | Transactional counters win; no in-memory counter may authorize a send. |
| Circuit state | PostgreSQL `safety_state` plus deployment switches | Metrics/readiness | Any open/disabled control blocks. Closing requires an explicit incident decision. |
| Reconciliation progress and ownership | PostgreSQL `watermarks`, `workflow_runs` and fenced `workflow_leases` checkpoints | Logs/metrics | One finite lease owns each scan. Fixed `(modifiedAt,id)` cursors resume safely; stale fence tokens cannot complete or advance the watermark. |
| Delivery acceptance and delivery outcomes | Mailgun event stream | PostgreSQL then EspoCRM projection | Mailgun is authoritative only for its transport outcome, never for contact eligibility. |
| Static thresholds and algorithms | Version-controlled worker code and reviewed deployment configuration | EspoCRM reason/version fields | Reviewed code/config wins; AI output cannot alter it. |
| Secrets and active key versions | Railway/environment secret store | Process memory | Secret store wins. No secret value belongs in EspoCRM, PostgreSQL payloads, logs or Git. |
| Legacy Lead/CampaignLogRecord migration evidence | Immutable approved `legacy-leads-v2` source/report digests plus the untouched EspoCRM source rows | Quarantined `MediaOutlet`/`MediaContact`, contact-linked `OutreachEvent`, PostgreSQL checkpoint and deny-wins suppression | Legacy data never authorizes sending. Stable `(modifiedAt,id)` ordering and deterministic external IDs make replay reproducible; current business policy and any denial still win. |

## Data flow rules

1. Accept a provider/CRM event only after signature validation.
2. Persist its encrypted raw payload and replay key before acknowledging.
3. Claim work with a lease; processing must be safe after crash and replay.
4. Re-read authoritative EspoCRM entities before any irreversible send.
5. Evaluate every hard gate, including purpose/basis evidence, and every suppression scope.
6. Reserve global and domain capacity transactionally.
7. Record a delivery attempt before the Mailgun request.
8. Treat a transport timeout after request transmission as uncertain.
9. Project confirmed outcomes into EspoCRM through idempotent events.

## Sequence ownership and completion

Sequence creation is intentionally dynamic. Allocation creates and queues only step `0`. Mailgun acceptance of step `0` records the immutable sequence start and schedules step `1` for day `+5`; acceptance of step `1` schedules step `2` for day `+11`. The day offsets are anchored to the first provider acceptance and then moved to the next allowed local send window when needed.

The worker must not pre-create all follow-ups. This prevents a stale future row from surviving a reply, bounce, unsubscribe, manual stop or newly discovered `No Submissions` policy. Immediately before every provider request, it reloads the EspoCRM release, contact, outlet and match and repeats suppression and eligibility checks.

After the final accepted step, EspoCRM becomes `Completed`, `activeSequence=false`, `nextActionAt=null` and receives `cooldownUntil`. PostgreSQL releases the active allocation with the same cooldown. A final accepted message is not the same as provider delivery or engagement; later signed provider events remain append-only outcomes.

## Suppression precedence

Suppression is evaluated at contact ID, email, outlet ID and domain scope. An active match at any scope denies the send. A self-service unsubscribe creates a contact suppression and cancels all pending messages for that match; complaints and hard bounces must also update the corresponding EspoCRM flags and business suppression record.

Removing a suppression is a human-controlled business action with evidence. Cache expiry or absence must never be interpreted as consent.

## Retention and deletion boundary

No retention duration is encoded here because it requires an approved privacy and records-retention policy. Before production enablement, the policy owner must approve durations for encrypted webhook payloads, copy, attempts, logs, business events and backups, plus deletion/anonymization procedures and legal-hold handling. “Keep forever” is not an acceptable default.

Deletion must preserve the minimum non-reversible or pseudonymous evidence needed to prevent re-contact, subject to legal review. Suppression hashes are still personal data when they can be related back through available identifiers.
