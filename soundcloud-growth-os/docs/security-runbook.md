# SoundCloud Growth OS security runbook

This runbook covers the two security boundaries owned by this service: browser/API administrator authentication and encrypted SoundCloud OAuth credentials. It does not authorize the deprecated outreach sender; production keeps `LEGACY_OUTREACH_SEND_ENABLED=false`.

## Required production invariants

- TLS terminates before the Next.js service. A production request whose effective URL is not HTTPS receives `503` without a Basic challenge.
- `GROWTH_OS_ADMIN_USERNAME` is unique to this service. `GROWTH_OS_ADMIN_PASSWORD` is 32–256 UTF-8 bytes, has sufficient character diversity, is not a placeholder, and is stored only in the platform secret store.
- `/api/health`, `/_next/static/*`, and the independently token-and-kill-switch-protected exact `/api/outreach/email` route are the only proxy authentication exceptions. Sensitive API handlers also check admin authentication themselves.
- `SOUNDCLOUD_TOKEN_ACTIVE_KID` names one key in `SOUNDCLOUD_TOKEN_KEYS_JSON`. The keyring has at most five canonical base64-encoded 32-byte keys. Only the active key encrypts; historical keys decrypt old envelopes.
- OAuth refresh obtains a bounded transaction-scoped PostgreSQL advisory lease per artist before rereading or decrypting the row and before any provider I/O. Revision plus encrypted row values fence persistence. A contending replica returns `503` and must not call the provider.
- API credentials may be sent only to a parsed `https://api.soundcloud.com` URL with the exact hostname, no userinfo, no non-standard port, no fragment, and redirects disabled. API reads have a 15-second overall deadline by default, five-second attempt aborts, a one-MiB decoded response cap, and classified bounded retries.
- `SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION` and `SOUNDCLOUD_TOKEN_REENCRYPT_APPLY` remain `false` on the web service. They are one-off job controls, not compatibility settings.
- Secrets and OAuth tokens are never included in URLs, logs, reports, exception messages, or committed environment files.

Generate secrets outside shell history where possible and place them directly in the Railway secret editor. Reference generation commands:

```bash
openssl rand -base64 48  # admin password
openssl rand -base64 32  # one AES-256 key
```

The browser sends Basic credentials in the `Authorization` header after its native challenge. Do not embed credentials in a URL. For API diagnostics, use a client that prompts for the password instead of placing it on the command line.

## Initial plaintext migration

The existing token columns retain their type; each value becomes a versioned `scg1` AES-256-GCM envelope. An additive integer revision provides deterministic OCC without placing plaintext in update predicates or logs. The AAD binds the envelope to the service, version, key id, artist id, model, and token field. This avoids rewriting the token columns and permits an online migration.

1. Back up the database and confirm restore evidence.
2. Configure an active key and keyring on the web service. Leave legacy migration disabled. Until migration finishes, legacy rows fail closed and SoundCloud sync is unavailable.
3. Run the re-encryption job as an isolated one-off process, first in dry-run mode. Enable `SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION=true` only for that process.
4. Set `SOUNDCLOUD_TOKEN_REENCRYPT_APPLY=true` only after reviewing the dry-run counts. Keep `SOUNDCLOUD_TOKEN_REENCRYPT_MAX_ROWS` between 1 and 1000.
5. If the result reports `truncated=true`, pass its `nextAfterId` as `SOUNDCLOUD_TOKEN_REENCRYPT_AFTER_ID` to the next bounded invocation. A conflict means a concurrent refresh changed the row; rerun that page rather than forcing an overwrite.
6. Traverse again in dry-run mode from an empty cursor. Require `needsReencryption=0` on every page, then remove both one-off migration flags from the job environment.
7. Run the bounded database-constraint validation with `SOUNDCLOUD_TOKEN_VALIDATE_CONSTRAINT=true`. It has a 5-second lock timeout and 30-second statement timeout. Remove that flag immediately afterward.

Command executed by the one-off process:

```bash
npm run job:reencrypt-soundcloud-tokens
npm run job:validate-soundcloud-token-constraint
```

The job prints counts and an opaque pagination cursor only. It never prints ciphertext or plaintext tokens. Exit code `2` means pagination or an OCC conflict still needs attention; exit code `1` means configuration/decryption failed and no success should be inferred.

The additive Prisma migration installs a `NOT VALID` check first: existing plaintext rows remain available to the isolated migration job, while every new insert/update must already use the `scg1` envelope. The final validation makes the invariant complete without a table rewrite during deploy.

## Key rotation

1. Generate a new 32-byte key with a new bounded `kid`.
2. Add it to `SOUNDCLOUD_TOKEN_KEYS_JSON` while the old key remains active; deploy and verify that existing tokens still decrypt.
3. Change `SOUNDCLOUD_TOKEN_ACTIVE_KID` to the new id; deploy. All OAuth and refresh writes now use only the new key.
4. Run the bounded re-encryption job in dry-run, then apply mode. Legacy plaintext permission is not needed for an envelope-to-envelope rotation.
5. Prove a full dry-run traversal has zero rows needing re-encryption.
6. Remove the historical key, deploy, and verify sync plus snapshot paths. Retain database backup evidence according to the approved retention policy.

Never rename a `kid`, reuse a key under a different trust decision, or remove a historical key before the zero-row proof.

The staged order is mandatory during a rolling deploy. Every old and new replica must first receive a keyring containing both keys; only then may the active key change. A queued rotated-key replica can read an old-key refresh winner without another provider call. An obsolete replica that cannot decrypt a new envelope fails before provider I/O. If the migration worker re-encrypts the same credential during an in-flight refresh, the refresh path recognizes the unchanged plaintext pair and re-fences the already obtained provider result without refreshing twice.

## Runtime bounds and readiness

- Keep `SOUNDCLOUD_REFRESH_LOCK_WAIT_MS` between `0` and `5000`; the default is `1500`. Raising it consumes a database connection while waiting, so prefer retrying the caller over a long wait.
- Keep `SOUNDCLOUD_API_DEADLINE_MS` between `1000` and `30000` and `SOUNDCLOUD_API_MAX_RESPONSE_BYTES` between `1024` and `4194304`. The production defaults are `15000` and `1048576`.
- Keep `SOUNDCLOUD_HEALTH_DB_TIMEOUT_MS` between `100` and `5000`; the default is `2000`.
- `/api/health` is public because Railway uses it for readiness. A successful response proves valid SoundCloud configuration, a usable active encryption keyring, valid bounds, and a bounded `SELECT 1` transaction. Failure always returns the same non-diagnostic `503` shape; use authenticated platform logs and database telemetry for diagnosis.

## Authentication rotation and incident response

Rotate the admin password in the platform secret store, redeploy, and verify that the old credential gets `401` while the new credential succeeds. Browsers may cache Basic credentials for the current session; close affected browser sessions during a revocation event.

For suspected token or encryption-key exposure:

1. Disable the service or revoke public access.
2. Revoke SoundCloud OAuth credentials through the official provider controls.
3. Rotate the encryption key and admin password; do not print or copy stored token values during investigation.
4. Inspect platform access/audit logs for route, timestamp, status, and request correlation only. Do not enable request-header or database-value logging.
5. Reconnect SoundCloud through the authenticated PKCE flow and verify encrypted-at-rest rows before resuming jobs.

## Verification checklist

- `npm test` passes, including auth bypass, malformed headers, encryption tamper/AAD/rotation/plaintext-gate, refresh lease/fencing races, exact-origin attacks, API deadline/size/retry behavior, and readiness deadlines.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- Unauthenticated `/dashboard`, OAuth, sync, snapshot, and report paths return `401`; missing/weak auth configuration returns `503`.
- Exact `/api/health` remains available without credentials, returns `200` only when configuration/keyring/database readiness succeeds, and contains no dependency or secret details.
- A database query shows `accessToken` and `refreshToken` start with the versioned envelope prefix and contain no provider token plaintext.
