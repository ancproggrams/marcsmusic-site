# Outreach requirements traceability

## Purpose and evidence boundary

This document maps the two approved design inputs to the implementation and to operational evidence. It is a point-in-time engineering control record, not an ISO certification, legal opinion, or claim that uncommitted code is deployed.

Snapshot: **2026-07-15, Europe/Amsterdam**  
Git baseline: **`main` at `d0b95d2`**, with the outreach implementation still present as uncommitted worktree content at the time of this review.

Source inputs:

| Source | Description | SHA-256 |
|---|---|---|
| A | Autonomous deterministic outreach pipeline | `9304b487b21a4fee887d796437b7c70555d697033dfd9b0881ff94087e3fcda1` |
| B | EspoCRM as central business system with Railway worker | `530dda0adbd94c6d52cb57908ecf6b1177ef82ebd96ae356d4ec293f92e7ca67` |

Evidence labels are intentionally strict:

- **WORKTREE-VERIFIED**: implementation exists and relevant local automated tests passed; this does not prove deployment.
- **WORKTREE-PARTIAL**: part of the requirement exists, but a specified code path or control remains open.
- **STAGING-UNPROVEN**: code may exist, but the required Railway runtime evidence is absent.
- **EXTERNAL**: credentials, provider configuration, another repository/worktree, or third-party action is required.
- **ORG**: policy, legal, privacy, supplier, change-approval, or operating evidence is required outside code.
- **P0**: production/send-enablement gate. **P1**: required hardening or business capability. **P2**: later maturity improvement.

No row may be upgraded from `STAGING-UNPROVEN`, `EXTERNAL`, or `ORG` based only on a unit test or configuration template. Any status change must add dated evidence and its command, deployment identifier, or approval reference.

## Requirements matrix

| ID | Requirement from sources | Priority/type | Current status and evidence |
|---|---|---|---|
| R01 | Outreach decisions are deterministic; AI never selects eligibility or recipients | P0 | **WORKTREE-VERIFIED.** Eligibility, scoring and allocation are deterministic in `eligibility-policy.mjs`, `match-score.mjs` and `campaign-allocator.mjs`; AI is restricted by `copy-policy.mjs`. |
| R02 | EspoCRM is the business source of truth; a separate database owns technical workflow state | P0 | **WORKTREE-VERIFIED.** The boundary is explicit in `docs/outreach/source-of-truth.md`; EspoCRM owns business state and PostgreSQL owns queues, leases, idempotency and safety state. |
| R03 | Custom MusicRelease, MediaOutlet, MediaContact, OutreachMatch, OutreachEvent, DailyReport and suppression models | P0 | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** Extension v1.2.2 installs in the pinned disposable EspoCRM image and its live API matrix covers every custom service type; the extension is not yet proven on Railway staging. |
| R04 | Required fields, enums, relations and uniqueness constraints | P0 | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** The pinned disposable verifier attests the schema/classmap, 16 required unique indexes, relationships, state hooks and exact conflict behavior. Restored Railway staging evidence remains absent. |
| R05 | No direct `NEW` to `SENT` transition | P2 | **RESOLVED-IN-WORKTREE; NOT DEPLOYED.** Worker and durable queue enforce the sequence, and an EspoCRM `beforeSave` hook applies the same versioned transition graph server-side. Architecture fitness tests reject unsafe create states, `New → Sent 1` and terminal-state delivery resume. |
| R06 | A new contact or outlet is evaluated against active releases | P0 | **WORKTREE-VERIFIED.** `match-service.mjs::processContact` and `processOutlet`. |
| R07 | A new release is evaluated against existing contacts | P0 | **WORKTREE-VERIFIED.** `match-service.mjs::processRelease` uses paged, deduplicated work enqueue. |
| R08 | Near-real-time EspoCRM webhooks | P0 / EXTERNAL | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** Signed, replay-safe routes and mappings exist; real webhook registrations and secrets are not live-proven. |
| R09 | Daily full reconciliation at 06:00 Europe/Amsterdam | P0 | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** Worker scheduling and bootstrap reconcile exist; no live worker deployment exists. |
| R10 | Five-minute overlap, fixed upper watermark and `(modifiedAt,id)` keyset pagination | P0 | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** Reconcile and client contracts are covered locally; the equal-timestamp live boundary probe has not run. |
| R11 | Fenced singleton reconcile, checkpoints and crash resume | P0 | **WORKTREE-VERIFIED.** PostgreSQL workflow leases, fencing and integration tests cover ownership and resume. |
| R12 | Signed producer integration for DJ Finder, Music Submission Agent and Release OS | P0 / EXTERNAL | **WORKTREE-PARTIAL / STAGING-UNPROVEN.** Release OS and DJ producer hooks exist locally. Music Submission Agent lives in an external dirty branch/worktree. No producer has staging targets and independent HMAC secrets activated. |
| R13 | Durable producer outbox, bounded retry, dedupe, replay and recovery after stale envelopes | P0 | **WORKTREE-PARTIAL.** Release OS and DJ now re-envelope stale semantic payloads with a new artifact ID/time while preserving records/digest, and have bounded retry/reissue/dead-letter tests. The external Music Submission Agent implementation was still in progress; therefore the original greater-than-24-hour outage wedge is not closed end-to-end. |
| R14 | Normalize email, domain, URL, country, language, genre and social identifiers | P0 | **WORKTREE-VERIFIED.** Normalization and strict source adapters provide the canonical forms; MediaContact also retains the source's optional show name in the audited `showName` field without using it as standalone identity. |
| R15 | Dedupe exact email and outlet domain while preserving deny-wins suppression | P0 | **WORKTREE-VERIFIED.** Global keyed fingerprints and immutable suppression semantics are covered. |
| R16 | Dedupe Instagram, name+outlet and show+outlet; merge using newest verified evidence | P1 | **WORKTREE-PARTIAL.** Compound candidate resolution and `verifiedEvidenceWins` are present in source ingestion with unit coverage. Final PostgreSQL conflict/concurrency evidence was still being completed at this snapshot. |
| R17 | Use a stable fingerprint/semantic digest when timestamps are unreliable | P1 | **WORKTREE-PARTIAL.** Email/domain fingerprints and signed semantic artifact digests exist. Full compound conflict fencing depends on completion of R16. |
| R18 | A hard eligibility gate runs before matching and immediately before sending | P0 | **WORKTREE-VERIFIED.** Valid email, evidence, purpose/basis, outlet status, no-submissions, suppression, campaign window, release and link requirements are re-evaluated. |
| R19 | Only Explicit Music Submission, Promo Contact and Press Contact are auto-contactable | P0 | **WORKTREE-VERIFIED.** Exact allow-list in eligibility and source contracts. |
| R20 | Persist contact basis plus proof URL, text and capture time | P0 | **WORKTREE-VERIFIED.** Espo fields and source contracts carry the evidence chain. |
| R21 | AI never determines lawful contactability | P0 / ORG | **WORKTREE-VERIFIED / ORG-OPEN.** Software is fail-closed; lawful-basis and ePrivacy assessment by country/role remains an organizational production gate. |
| R22 | Deterministic 0–100 scoring with 80 auto / 65 waitlist thresholds | P0 | **WORKTREE-VERIFIED.** The later, more specific source threshold wins; all stated positive and negative signals are tested. |
| R23 | Positive replies and genre rejection affect future scoring | P1 | **RESOLVED-IN-WORKTREE; NOT DEPLOYED.** `Future Releases` projects only an explicit preference; `Not Suitable` appends a deny-wins PostgreSQL genre denial and OCC-merges the canonical EspoCRM genre union. Matching and send gates consume those fields; concurrency tests preserve the union. |
| R24 | One active sequence per contact; release/contact/step is unique | P0 | **WORKTREE-VERIFIED.** Atomic allocation, privacy-hashed recipient ownership and unique send idempotency are PostgreSQL-backed. |
| R25 | The highest-scoring release wins deterministically | P0 | **WORKTREE-VERIFIED.** Score, release priority and release ID provide stable ordering. |
| R26 | At most two contacts per outlet/campaign | P0 | **WORKTREE-VERIFIED.** Allocator and durable outlet allocation enforce the cap. |
| R27 | At most one first email per outlet within 14 days | P0 | **WORKTREE-VERIFIED; NOT DEPLOYED.** Outlet-scoped advisory locking, active allocation cap and atomic `initial_sent_at` cooldown are covered by a concurrent-replica PostgreSQL test. |
| R28 | No new recipient pitch within 21 days | P0 | **WORKTREE-VERIFIED.** Recipient allocation stores and enforces the transactional cooldown. |
| R29 | Daily, release and domain limits are durable | P0 | **WORKTREE-VERIFIED.** Europe/Amsterdam counters and reservations are transactional. |
| R30 | Independent global kill switch and send-enable control | P0 | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** Both exact controls fail closed in code. There is no worker deployment; values must be re-attested before any deployment. |
| R31 | Send Tuesday–Thursday, 09:30–11:30 local time, with deterministic spreading | P1 | **WORKTREE-VERIFIED.** Scheduler tests cover local time, allowed days and deterministic jitter. |
| R32 | Sequence on day 0, 5 and 11, with at most two follow-ups | P0 | **WORKTREE-VERIFIED.** The next step is created only after confirmed provider acceptance. |
| R33 | Reply, bounce, unsubscribe, complaint and manual stop terminate the sequence | P0 | **WORKTREE-VERIFIED.** Signed events, synchronous deny-wins safety events and queue cancellation are covered. |
| R34 | AI receives only structured, evidence-backed facts | P0 | **WORKTREE-VERIFIED.** The provider may choose only an allowed evidence ID, exact supplied genre and approved tone; it does not write sendable prose. |
| R35 | Strict provider JSON, confidence fallback and no free-form AI send | P0 | **WORKTREE-VERIFIED.** Invalid or below-0.85 selection falls back to deterministic copy; running without a provider is supported. |
| R36 | No hallucinated claims; maximum 120 words; exactly one CTA; no attachments; URL allow-list and unsubscribe | P0 | **WORKTREE-VERIFIED.** Copy validator, evidence requirement and text-only provider payload are tested for every sequence step. |
| R37 | Use the recipient's supported preferred language | P1 | **RESOLVED-IN-WORKTREE; NOT DEPLOYED.** Deterministic `nl`, `en`, `de`, `fr`, `es`, `pt` and `other` fallback templates now localize subject, body and unsubscribe label. Every step remains evidence-bound, at most 120 words and exactly one CTA. Tests: `scheduler-and-copy.test.mjs`. |
| R38 | Verify the selected allow-listed release link works before copy persistence/queueing | P1 / SECURITY | **RESOLVED-IN-WORKTREE; NOT DEPLOYED.** `ReleaseLinkReachabilityChecker` accepts HTTPS/443 only, rejects credentials and private/link-local/loopback/reserved IPv4/IPv6, validates every DNS answer and redirect, pins TLS/SNI connections to the validated address, bounds redirects/time/header bytes, uses `HEAD` with bodyless ranged `GET` fallback, and is abort-aware. `4xx` is permanent except retryable `408/429`; `5xx`, network and timeout are retryable. The tokenized unsubscribe URL is never probed. A permanent initial pre-queue failure releases only that match allocation without cooldown; a transient failure retains its idempotent allocation. Tests: `release-link-reachability.test.mjs`, `copy-service-link-gate.test.mjs` and `matching-and-allocation.test.mjs`. |
| R39 | Keep Spotify outside AI input; add only deterministic owned links | P0 | **WORKTREE-VERIFIED.** `spotifyUrl` is excluded from copy facts; copy uses only the selected EPK/private stream. |
| R40 | EPK contains stream/download, artwork, ISRC, BPM, bio, release date and rights/contact information | P1 / EXTERNAL | **WORKTREE CONTROL VERIFIED; PRODUCTION CONTENT OPEN.** The strict public EPK contract and bounded verifier require all listed content, rights and contact evidence and block CRM activation without a verified attestation. The committed manifest is intentionally fictional/example-only; no audited public production manifest or live asset proof exists. |
| R41 | Deterministic reply classifications | P0 | **WORKTREE-VERIFIED.** Interested, asset requests, placement, warm, rejection, no-submissions, wrong person, unsubscribe, OOO, future releases and ambiguous are covered. |
| R42 | Automatically answer only allowed MP3/WAV/radio-edit requests | P0 | **WORKTREE-VERIFIED.** Responses use existing allow-listed release URLs, their own durable queue/caps and a deny-wins preflight. |
| R43 | Parse OOO return date and resume safely | P1 | **WORKTREE-VERIFIED.** Date extraction, seven-day fallback, pause and resume job are present. |
| R44 | Create an EspoCRM Opportunity when interest is confirmed | P1 | **RESOLVED-IN-WORKTREE; NOT DEPLOYED.** Every positive current-release classification converges on one match-keyed Opportunity. Origin/identity are immutable, stronger signals advance monotonically and no revenue, probability or close date is invented. Replay and concurrent unique-race tests pass. |
| R45 | Project reply-derived positive and rejected-genre preferences to the contact | P1 | **RESOLVED-IN-WORKTREE; NOT DEPLOYED.** Future-release preference and deny-wins rejected-genre projection are deterministic, source-event linked and OCC/fence protected; neither path manufactures lawful basis or opt-in. |
| R46 | Treat ambiguous replies and outlet-wide suppression conservatively | P0 / CONTROLLED DEVIATION | **WORKTREE-VERIFIED.** Ambiguous/no-submissions cases enter encrypted human review. The worker deliberately does not auto-reply or broadly suppress an outlet without attributable review evidence. |
| R47 | Register both an outgoing EspoCRM Email and an OutreachEvent | P1 | **RESOLVED-IN-WORKTREE; NOT DEPLOYED.** Confirmed provider acceptance atomically queues projection work. Deterministic unique standard Email and immutable OutreachEvent receipts carry provider/deterministic/correlation IDs, accepted time and actual copy versions; delivery-unknown never fabricates Sent. Replay tests pass. |
| R48 | Group/report through EspoCRM Campaign and Target List | P2 | **RESOLVED-IN-WORKTREE; DISPOSABLE-RUNTIME PROOF PENDING.** One deterministic Campaign and real Target List are projected per release. Only freshly eligible delivered contacts are related; writes are allow-listed, read-after-write verified and Campaign counts OCC-reconciled. Multi-contact/concurrent replay tests pass; pinned EspoCRM/MySQL API evidence is still required before staging. |
| R49 | Configure Group Email Account or Mailgun inbound reply routing | P0 / EXTERNAL | **WORKTREE CONTROL VERIFIED / STAGING-UNPROVEN.** `/capabilities` now distinguishes operator-attested `configured` inbound-route evidence from `unknown` and never infers a route from Mailgun domain health. No live Group Email Account, mailbox job or signed inbound-route test is yet evidenced. |
| R50 | Use a least-privilege EspoCRM API user | P0 / EXTERNAL | **DOCUMENTED CONTROL / STAGING-UNPROVEN.** The runbook now defines the exact maximum grant/deny matrix and an identity, cross-owner read, forbidden-scope, managed-receipt, negative core-send and revocation proof procedure. No live API user, sanitized effective-grant export, absence of personal/group SMTP identity, provider-zero-send evidence, credential custody or revocation run exists. This remains a P0 gate. |
| R51 | Run EspoCRM daemon, webhook queue and scheduled jobs under supervision | P0 | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** PID 1 supervision, daemon and watchdog contracts exist; no live runtime attestation exists. |
| R52 | Produce the requested daily operational report counters | P1 | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** Daily report service and entity contain the requested metrics; no live report run exists. |
| R53 | Bounded retries, DLQ, audit trail, correlation and `delivery_unknown` | P0 | **WORKTREE-VERIFIED.** PostgreSQL inbox/work/send/response queues, leases, append-only events and uncertain-delivery quarantine are integration-tested. |
| R54 | Circuit breaker on harmful bounce/failure cohorts and immediately on complaint | P0 | **WORKTREE-VERIFIED.** Hourly cohort health plus synchronous complaint/confirmed-unauthorized-recipient circuit opening are covered. |
| R55 | Retained metrics, alerts and dashboard | P1 / EXTERNAL | **WORKTREE-PARTIAL.** Protected Prometheus metrics and runbook queries exist. Metrics remain process-local and no retained Prometheus/OTel store, alert routing or live dashboard is evidenced. |
| R56 | Encryption, versioned key rotation and bounded re-encryption | P0 / ORG | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** AES-256-GCM keyring and bounded re-encryption job are covered; key custody, staging rotation and restore evidence are operating controls still required. |
| R57 | CI quality gate, dependency audit, secret scan and SBOM | P0 | **WORKTREE-VERIFIED / EXTERNAL-UNPROVEN.** Workflow and gitleaks policy exist in the worktree; GitHub has not run them for this uncommitted tree. |
| R58 | Controlled legacy Lead migration with digest-bound dry run and canary | P0 / ORG | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** Dry-run, approvals, checkpoints and at-most-five canary are tested; the staging dry-run/canary has not run. |
| R59 | Retention, deletion/anonymization, DSAR and legal hold | P0 / ORG | **OPEN.** Policy decisions and the corresponding jobs/partitions/right-handling cases are not complete; send enablement must not treat this as implemented. |
| R60 | ISO 27001/27701 and NIS2 control evidence | ORG | **DESIGN ONLY.** `compliance-evidence.md` maps control intent. It is not certification or operating-effectiveness evidence. |
| R61 | Supplier/processor governance | P0 / ORG | **OPEN.** DPAs, subprocessor inventory, transfer/residency assessment, vendor risk, exit plan and independent approval remain outside Git. |
| R62 | Privacy/legal approval for the campaign | P0 / ORG | **OPEN.** Lawful basis, country/role direct-marketing rules, notice, DPIA screening, evidence refresh and accountable approval remain production gates. |
| R63 | Use the real Mailgun webhook HTTP signing key | P0 / EXTERNAL | **OPEN.** A cached, bounded, non-mutating Mailgun domain/auth probe now detects revoked API credentials with redacted reason codes, but it deliberately does not claim to validate the separate webhook signing key. The actual account signing key must still be supplied through secret custody. |
| R64 | Independent email validation | P0 / EXTERNAL | **WORKTREE-VERIFIED / STAGING-UNPROVEN.** HTTP and bounded SMTP/MX validation remain fail-closed and abort-aware. `/capabilities` now reports disabled, live-available, unavailable or honestly unknown provider health; HTTP live health requires an explicit non-mutating endpoint. No approved live provider/credential or operating evidence exists. |
| R65 | Production cutover with autonomous send disabled and the legacy sender off | P0 / ORG / EXTERNAL | **NOT READY.** Legacy routes default disabled in code, but neither CRM nor worker is deployed and cutover evidence/approval is absent. |

## Railway staging evidence

Environment inspected: `outreach-staging` (`93452…`). This section records what is actually evidenced, not what the worktree intends.

- CRM service `6092…` still has only the old temporary nginx deployment `61128076…` active and successful. New image builds `ea9a5529…` and `607abf6d…` failed during Docker `COPY`, before runtime. They did not mutate the database or persistent volume.
- The configured CRM volume remains mounted at `/var/www/persistent`, but EspoCRM 10.0.2 readiness, extension install/schema, deployment attestation, daemon/watchdog, and restart recovery are **not live-proven**.
- MySQL service `97ac…` is active on deployment `7b823fd9…`, exact `mysql:9.4` digest `sha256:135bc87…`. Restore evidence binds 141 tables and 2,815 Leads/config, but live post-upgrade validation is still absent.
- The worktree deployment contract, Docker Compose harness and verifier are aligned to the same pinned MySQL 9.4 digest. The complete local disposable run now passes with 153 live HTTP requests: 11/11 unique services, 10/10 immutable service boundaries, 3/3 relationships, 20 rejected state mutations and 8 accepted updates. This is strong local release evidence, but it is not Railway or restored-production-state evidence.
- Worker service `53f…` has a public domain but `latestDeployment=null`; `/livez`, `/readyz`, capabilities, migrations, reconciliation, source ingestion and no-send E2E behavior are not deployed or proven.
- No statement in this document authorizes send enablement. Before the first worker deployment, independently attest `OUTREACH_KILL_SWITCH=true` and `OUTREACH_SEND_ENABLED=false`.

## Current production gates

The following remain P0 regardless of local test success:

1. Finish R13 for the external Music Submission Agent and retain its schema/reissue test evidence.
2. Freeze and review the locally verified EspoCRM v1.2.2 artifact and bind its package/runtime hashes plus the 153-request result into the release evidence; repeat it against restored Railway staging.
3. Fix the CRM Docker build path, deploy staging, and prove extension/schema, volume, restore binding, daemon/watchdog and restart behavior.
4. Deploy the worker with the kill switch on and sending off; run migrations and prove readiness/capabilities.
5. Configure and evidence the least-privilege API user, Espo webhooks, Mailgun inbound/signing key, and approved email-validation route.
6. Activate all three producers in staging with distinct HMAC keys and run stale-outbox/replay recovery end to end.
7. Run no-send E2E for duplicate webhooks, suppression, terminal stop, 4xx release-link dead-letter/allocation release, uncertain delivery, DLQ, reconcile and restart.
8. Execute the legacy dry run and at-most-five staging canary with recorded approval digests.
9. Complete retention/DSAR/legal-hold design, privacy/legal campaign approval and supplier/processor governance.
10. Commit through reviewed CI and retain secret-scan, dependency-audit and SBOM evidence.

## Accepted architectural decisions

- PostgreSQL replaces an additional n8n/Redis layer for queues, leases, replay and workflow state, reducing the operational surface while retaining the required behavior.
- The later source's 80/65 scoring thresholds supersede the earlier illustrative 75/60 thresholds.
- Ambiguous replies and outlet-wide suppression require attributable human review instead of an unsafe automatic response or broad deny action.
- A deterministic template is the safe default; an AI provider is optional and cannot expand facts, recipients, links or legal eligibility.

## Update procedure

When changing a row, update the snapshot date and attach at least one of:

- test command and pass count;
- immutable deployment ID/image digest plus readiness/attestation output;
- external provider configuration evidence with secrets redacted;
- organizational approval/change/legal reference.

Never replace `STAGING-UNPROVEN`, `EXTERNAL`, or `ORG` with `complete` solely because implementation code exists.
