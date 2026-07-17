# Source artifact v1 / request authentication v2 production contract

## Purpose and trust boundary

This contract connects existing discovery and release systems to EspoCRM without moving scraping, browsing, source inference, or email-verification decisions into the outreach worker. Producers own discovery. The worker accepts only bounded, signed facts with attributable evidence and applies deterministic upserts.

The accepted source identities are:

| Source ID | Current Railway source | Accepted records | Required producer change |
| --- | --- | --- | --- |
| `dj-finder` | `dj-finder-cron`, `/data/dj_contacts.csv`, 15-minute discovery | `mediaOutlet`, `mediaContact` | The in-process Python overlay at `deploy/dj-finder-worker/producer` runs only after successful discovery and owns a durable outbox on the same volume. Railway volumes cannot be shared with a separate sidecar. |
| `music-submission-agent` | `music-submission-agent`, verified SQLite platform exporter | `mediaOutlet` | Its native SQLite outbox stages after export and signs persisted bytes. The public `/platforms` response is never used as an ingestion source. |
| `marcsmusic-release-os` | `marcsmusic-release-os`, persistent JSON release store | `musicRelease` | Its native JSON outbox is staged in the same store commit as the release. Records without ISRC, EPK/private-stream URL, or source evidence remain held. |

Discovery services must never call EspoCRM directly. The existing legacy DJ-to-Espo and direct email scripts remain outside this contract and must stay disabled during cutover.

The generic `source:publish` job is retained for contract canaries and bounded
backfills. Production uses the source-native outboxes above so discovery/store
commits and artifact staging share one failure domain. All producers keep exact
artifact bytes across a retry and create a new request nonce/timestamp.

## Artifact envelope

```json
{
  "schemaVersion": "1.0",
  "sourceId": "dj-finder",
  "artifactId": "snapshot-20260715T090000Z-a1b2c3",
  "generatedAt": "2026-07-15T09:00:00.000Z",
  "records": []
}
```

Artifacts contain 1–500 records, are no older than `SOURCE_INGESTION_MAX_ARTIFACT_AGE_SECONDS`, and use unique `(kind, externalId)` pairs. JSON is strict: unknown fields fail the whole artifact before any CRM mutation.

Every record includes:

```json
"evidence": {
  "url": "https://source.example/submissions",
  "text": "The page explicitly identifies this route for music submissions.",
  "capturedAt": "2026-07-15T08:58:00.000Z"
}
```

Only HTTPS evidence is accepted. Full schemas and source adapter mappings are executable in `src/domain/source-artifact.mjs` and `src/domain/source-adapters.mjs`.

### Source URL canonicalization

Producer adapters and the worker's artifact parser use the same fail-closed
canonicalizer before semantic artifact-ID generation, evidence digesting, or CRM
projection. It applies to outlet websites, submission URLs, every evidence URL,
contact Instagram URLs and all release URL fields.

- URLs are bounded to 512 characters and must be absolute HTTPS URLs without
  user credentials or fragments.
- Raw whitespace, controls and backslashes, malformed percent escapes, invalid
  UTF-8 escapes and percent-encoded control characters are rejected rather than
  repaired.
- The host is IDNA/lowercase-normalized, a trailing DNS root dot and default
  port `443` are removed, and URL path dot segments are resolved.
- Only case-insensitive `utm_*`, `fbclid`, `gclid` and `msclkid` query keys are
  removed. Other parameters, including access tokens, signatures, revisions,
  affiliate identifiers and source references, remain functional data.
- Remaining parameters are sorted deterministically by decoded key and value;
  duplicate values are retained.

The producer's artifact-ID digest is therefore based on canonical records, and
the worker projects those same canonical values. This semantic normalization
does not alter transport authentication: the HMAC and receipt content digest
continue to bind the exact JSON bytes. A retry must still reuse the persisted
body byte-for-byte, even when a reconstructed body would canonicalize to the
same records.

## Authentication

Generate a different random key for every source. The strict versioned worker
schema has one active signing key and at most five verify-only historical keys
per source. Key material must also be unique across sources:

```text
SOURCE_INGESTION_ENABLED=true
SOURCE_INGESTION_KEYRINGS_JSON={"schemaVersion":2,"sources":{"dj-finder":{"active":{"kid":"dj-2026-07","key":"<independent 32+ character key>"},"verifyOnly":[]},"music-submission-agent":{"active":{"kid":"msa-2026-07","key":"<different 32+ character key>"},"verifyOnly":[]},"marcsmusic-release-os":{"active":{"kid":"release-os-2026-07","key":"<different 32+ character key>"},"verifyOnly":[]}}}
```

Set only the matching active `kid` and key in each producer. Producers never
receive verify-only keys. Do not reuse an EspoCRM webhook, Mailgun, hashing,
unsubscribe, encryption, or another source's key.

Native DJ Finder and Release OS use
`OUTREACH_SOURCE_SIGNING_KEY_ID`/`OUTREACH_SOURCE_SIGNING_KEY`. The bounded
generic canary/backfill emitter uses
`SOURCE_EMITTER_SIGNING_KEY_ID`/`SOURCE_EMITTER_SIGNING_KEY`. The archived
external MSA patch does not yet satisfy this v2 contract; its required future
delta is documented in the [MSA integration addendum](../../../docs/outreach/msa-integration-evidence.md)
and remains a production no-go until implemented on a governed baseline.

Canonical signature input:

```text
v2\n<sourceId>\n<keyId>\n<unix-seconds>\n<nonce>\n<lowercase SHA-256 of exact JSON bytes>
```

The request carries `x-source-key-id: <keyId>` and
`x-source-signature: v2=<lowercase HMAC-SHA256 hex>`. Unknown kids, v1
downgrades, and signatures made with another source's key fail closed. A retry
keeps `artifactId` and body identical but uses a new nonce and timestamp. A
reused nonce is rejected. Reusing an artifact ID with different bytes is a
terminal collision; URL canonicalization deliberately does not weaken this
exact-byte transport invariant. Rotation is add-new-active/move-old-to-
`verifyOnly`, deploy consumer first, then producer; see the key-rotation runbook.

## Deterministic CRM behavior

- `MediaOutlet`: controlled unique lookups use fingerprint and normalized website domain. Exact name+domain is a compatibility lookup; the privacy-hashed registry stores the normalized name alias for later cross-source matches.
- `MediaContact`: controlled identities use normalized email, `SHA-256(normalized email + canonical outlet domain + normalized contact name)`, canonical Instagram, LinkedIn-personal-profile and SoundCloud-profile accounts, normalized name+outlet and normalized show+outlet. The former email-only fingerprint remains a read-only compatibility alias during migration; new writes use the composite fingerprint. A contact still requires an already ingested source/outlet link.
- `MusicRelease`: deduplicated by ISRC, preserves an existing EspoCRM status, and starts as `Draft` when new.
- `MediaOutlet.genres` contains only bounded main genres.
  `MediaOutlet.subGenres` and `MediaOutlet.formatGenres` are separate bounded
  controlled lists; `formatGenres` is never copied from or defaulted to
  `genres`. Missing language remains missing.
- `MusicRelease.subGenres` is bounded and controlled.
  `MusicRelease.territories` contains at most 64 uppercase ISO alpha-2 values.
  Missing language, territory, format, or subgenre values remain empty rather
  than being guessed.
- Recipient locale fields are canonicalized from an explicit bounded mapping.
  Copy languages are limited to `en`, `nl`, `de`, `fr`, `es` and `pt`; country
  names/codes are mapped to the supported ISO 3166-1 alpha-2 allowlist; and
  timezones must be valid named IANA zones. Missing or unsupported language,
  country or timezone values remain missing and fail the automatic-send gate.
  The pipeline never substitutes English, UTC or `Europe/Amsterdam`.
- Evidence is stored on outlet/contact fields. Release evidence is appended to its audited description because the current extension has no dedicated release-source field.
- PostgreSQL stores receipts, nonces, CRM link IDs, evidence digests, and keyed email hashes. It does not store raw email addresses in validation cache.

Every outlet/contact identity set receives a finite PostgreSQL claim before any
CRM mutation. Claims serialize overlapping artifacts and are bound to the CRM
ID in the same transaction as the artifact record link. A stale artifact lease
rolls both writes back. If email, fingerprint, Instagram, LinkedIn, SoundCloud, name+outlet,
show+outlet or an existing registry alias point to more than one CRM ID, the
artifact fails closed with `SOURCE_DEDUP_AMBIGUOUS`; ingestion never chooses a
winner heuristically.

The claim locks every candidate but promotes only aliases accepted by the
merge. Mutable name/show/Instagram aliases require winning verified evidence;
email and composite/legacy fingerprints additionally require the canonical
email to be unchanged or independently `Valid` and replaced. Unverified or
losing aliases are not inserted into the resolving registry. Claims are renewed
immediately before the bounded external CRM mutation, and an expired claim
fails before that side effect. The source record link itself advances only for
strictly newer evidence, so arrival order cannot regress the recorded source.

Only strictly newer, explicitly verified source evidence can replace an
existing verified projection. Unverified evidence may create a quarantined new
record but cannot overwrite an existing projection or promote an alias.
`likely_valid` remains unverified. `Ready for Matching` requires both exact
independent email validation and verified canonical source evidence, plus an
allowed contact purpose and basis. Email replacement also requires an
independent exact `Valid` result. Equal evidence timestamps are not treated as
newer; EspoCRM timestamps are interpreted explicitly as UTC.

Denials are monotone. Existing `Blocked`, `doNotContact`, `optedOut`,
`hardBounced`, `No Submissions` and active contact/outlet/email/domain
suppressions always win over source evidence. Source merges share the same
PostgreSQL advisory-lock namespace as suppression writes, recheck suppression
under that fence, never write a denial flag back to `false`, and never make a
denied contact matchable.

`source_identity_bindings` stores only keyed hashes and CRM IDs; raw email,
names, show names and social handles are not persisted in PostgreSQL.
`source_identity_claims` and its claim items are short-lived coordination state.
Existing legacy CRM contacts can be found through exact CRM fields on their
first encounter; normalized name/show aliases become available after that
record has been bound once. `firstName`, `lastName` and `showName` are explicit
audited CRM fields; pre-existing records still require a governed source replay
to seed their privacy-hashed registry aliases rather than a fuzzy CRM scan.
Production cutover therefore requires that governed replay and its collision
report, and the source pipeline remains the only automated writer of these
canonical alias fields. The global hash-key namespace is bound to an
immutable database epoch and keyed attestation. There is deliberately no
per-row dual-read/write rehash path; hash-key rotation or CRM erasure still
requires a separately approved bounded rehash/erasure migration before
changing either `OUTREACH_HASH_KEY` or its epoch. Startup refuses silent key
or epoch drift.

Artifact processing uses a fenced PostgreSQL lease (`lease_owner`, monotonic
`lease_version`, and `locked_until`). The worker renews that lease while
processing. Record-link, failure, and completion writes require the exact live
lease token; an expired or stolen worker stops with
`SOURCE_ARTIFACT_LEASE_LOST`. CRM upserts remain idempotent, so a worker that
loses its lease during an external CRM call cannot commit an unfenced link.

No ingestion operation activates a campaign or sends mail.

Matching awards points only for explicit evidence on both sides of an overlap.
Empty and `Other`/unknown language, territory, format, or subgenre signals award
zero. A release/outlet pair with only main-genre overlap, an explicit submission
route, and current independent email validation scores `25 + 15 + 5 = 45`, well
below the default automatic threshold of 80. Unit and application-integration
tests pin that invariant.

## Independent email validation

For production MarcsMusic, use the existing EU Mailgun account as the
validation provider without re-enabling Mailgun outbound delivery:

```text
EMAIL_VALIDATION_PROVIDER_ENABLED=true
EMAIL_VALIDATION_PROVIDER_TYPE=mailgun
MAILGUN_BASE_URL=https://api.eu.mailgun.net
MAILGUN_VALIDATION_API_KEY=<Railway secret with Email Validation permission>
MAILGUN_DOMAIN=mg.marcsmusic.nl
```

The validation key must have Mailgun Email Validation permission; a legacy
sending/webhook-only key is not sufficient. The worker calls Mailgun
`GET /v4/address/validate` with Basic authentication
and `provider_lookup=true`. This is a validation request, not a send path.
Only Mailgun `deliverable` + low risk + non-role + non-disposable results map
to `Valid`; all other ambiguous results remain `Risky`, `Invalid` or `Unknown`.
The existing `doNotContact`, opt-out, consent-basis and evidence gates remain
independent and are never cleared by a provider result.

Configure an HTTPS provider:

```text
EMAIL_VALIDATION_PROVIDER_ENABLED=true
EMAIL_VALIDATION_PROVIDER_TYPE=http
EMAIL_VALIDATION_PROVIDER_URL=https://validator.example/v1/check
EMAIL_VALIDATION_PROVIDER_TOKEN=<secret bearer token>
EMAIL_VALIDATION_PROVIDER_TIMEOUT_MS=10000
EMAIL_VALIDATION_CACHE_TTL_DAYS=30
```

The worker sends `POST {"email":"..."}` with bearer authentication and an `idempotency-key`. The provider must return only:

```json
{
  "status": "Valid",
  "checkedAt": "2026-07-15T09:01:00.000Z",
  "providerReference": "check-immutable-id"
}
```

Only exact `Valid` permits `Ready for Matching`. Disabled provider is a supported but fail-closed state: new contacts remain `Needs Validation` / `Unknown`. A network failure or malformed provider response fails the artifact so the same artifact can be retried idempotently.

### Optional bounded SMTP/MX mode

Set `EMAIL_VALIDATION_PROVIDER_TYPE=smtp` while keeping
`EMAIL_VALIDATION_PROVIDER_ENABLED=true`. This optional mode resolves at most
`EMAIL_VALIDATION_SMTP_MAX_MX_HOSTS`, rejects private/reserved destination IPs,
and has separate connect, command, and total deadlines. It performs only an
SMTP envelope probe: `EHLO`, null `MAIL FROM`, `RCPT TO`, `RSET`, a random
catch-all `RCPT TO`, and `QUIT`. The implementation contains no `DATA` command
and therefore never sends a message.

SMTP status is deliberately fail-closed:

- exact recipient `250` plus catch-all `5xx`: `Valid`;
- recipient `5xx`: `Invalid`;
- recipient `4xx`, non-exact `2xx`, timeout, DNS/network failure: `Unknown`;
- recipient `250` with accepted or inconclusive catch-all: `Risky`.

Only `Valid` can become `Ready for Matching`. Direct SMTP can be blocked by a
hosting provider and is less authoritative than a contracted HTTPS verifier;
in that case leave it disabled rather than weakening the status mapping.

## Cutover and rollback

1. Apply PostgreSQL migrations with source ingestion still disabled.
2. Deploy the worker with `OUTREACH_KILL_SWITCH=true` and `OUTREACH_SEND_ENABLED=false`.
3. Configure all source v2 keyrings and producer active kids/keys plus the validation provider in staging.
4. POST one artifact per source and verify receipt counts, CRM evidence, deduplication, and `Draft`/`Needs Validation` states.
5. Enable signed producer export in production while all legacy direct-CRM/direct-send paths remain stopped.
6. Alert on `outreach_source_artifacts_total{outcome="failed"}` and on a missing successful artifact for two producer intervals.

Rollback is to set `SOURCE_INGESTION_ENABLED=false` and stop producer POSTs. Existing CRM records remain auditable; no destructive rollback is performed. Source ingestion and outbound sending are independent controls.
