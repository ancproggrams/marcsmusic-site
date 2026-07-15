# Music Submission Agent integration evidence

## Decision

**NO-GO for import, merge, deployment, or production activation.**

The archived material is recovery evidence for the isolated outreach change only. It is not an approved Music Submission Agent baseline and must not be applied directly to `main`. The target main revision used during rehearsal, `d0b95d24208c8a3497e6ba837c2f11f4b6d1b6f7`, does not contain the Music Submission Agent service tree.

## Evidence scope

The secured backup namespace is:

```text
$CODEX_BACKUP_ROOT/marcsmusic-outreach/20260715T090000Z/msa-integration/
```

The directory and parent timestamp directory are mode `0700`. Each artifact is mode `0600`.

| Artifact | SHA-256 | Size | Purpose |
|---|---|---:|---|
| `manifest.json` | `8905884b626fe3ee6e4afa76952ef616064c3349e1d3b7918d65a64afc9abe38` | 8,376 bytes | Machine-readable provenance, per-file hashes, validation and blockers |
| `msa-outreach.patch` | `4f6a372720fe11ccb32fd9f2c45e5a835ef9b298ac2bdac92d083e685ea94d2d` | 81,541 bytes | Full-index Git patch against source HEAD |
| `msa-outreach-files.tar.gz` | `2b26b1e37d7c6a696698b008d44f983b6a366e656f9cf1374e34e449a9ae3f72` | 29,481 bytes | Exact 16-file recovery snapshot |

Source HEAD is `0040b3eb9458e0f30dd73345fa156b2e66b40a20`. The patch contains 12 tracked modifications and four additions, totaling 1,672 insertions and eight deletions. The 16 source files contain 126,107 bytes. Full per-file SHA-256 values and sizes are retained in `manifest.json`; no secret value is reproduced in this repository document.

The only environment-shaped path is `.env.example`. It is an inert template whose signing and recovery secret fields are empty. No runtime `.env`, credential, token, user asset, generated database, report, export or SQLite file is present.

Explicitly excluded:

- root `.gitignore`, `index.html` and `server.js` user changes;
- `assets/audio/**` and every other user asset;
- service `data/**`, `reports/**`, `dist/**`, `node_modules/**`, exports and SQLite files;
- runtime environment files and secrets.

## Verification evidence

The isolated integration rehearsal on source HEAD plus the archived patch passed:

- ESLint, Prettier, application TypeScript and test TypeScript;
- all 19 tests;
- `npm run build`;
- `git diff --check`;
- clean application of all 16 paths to a disposable `0040b3e` checkout;
- equality of every restored file, tar entry and manifest SHA-256.

Gitleaks 8.30.0 scanned the final directory, including archive traversal, with 100% finding redaction. It scanned approximately 216 KB and found zero leaks.

## Why integration remains blocked

The branch name `music-submission-agent-service` is a moving target. Multiple different remote tips were observed during the same audit. Recent remote snapshots also failed formatting and TypeScript/build validation before this outreach patch was applied, including a missing `DiscoveryWorker` export. Conversely, the archived `0040b3e` source is testable but materially stale.

Required strategy:

1. Stop the automation writing to the branch.
2. Pin one immutable reviewed source SHA or signed release artifact.
3. Repair that baseline until lint, both TypeScript checks, tests, build and container verification pass.
4. Import the governed baseline separately, excluding generated runtime artifacts.
5. Apply `msa-outreach.patch` as its own reviewed change.
6. Repeat secret scanning, migration tests, restore tests and production release gates.

No merge of the historical branch and no direct cherry-pick of its generated commit stream is approved.

## Required v2 addendum for a future governed baseline

The write-stopped archive and its recorded checksums above were not mutated by
the July 2026 source-boundary/key-rotation work. Therefore the archived patch is
not sufficient for a future production integration until a newly pinned MSA
baseline implements and proves all of the following as a separately versioned
patch bundle:

- outlet `genres`, `subGenres`, and `formatGenres` are separate bounded
  controlled lists; `formatGenres` must never fall back to or copy `genres`;
- blank language is omitted rather than defaulted to English; an unrecognized
  language may be represented as controlled `other`, but language/format/
  subgenre unknowns cannot become positive match evidence;
- every website, submission, and evidence URL adopts
  `source-url-conformance-v1.json` before semantic digest/artifact-ID generation;
  only `utm_*`, `fbclid`, `gclid`, and `msclkid` are stripped and functional
  query parameters remain;
- the producer uses only `OUTREACH_SOURCE_SIGNING_KEY_ID` plus
  `OUTREACH_SOURCE_SIGNING_KEY`, sends `x-source-key-id`, and signs
  `v2\n<sourceId>\n<keyId>\n<timestamp>\n<nonce>\n<SHA256(exact-body)>` with
  a `v2=` header; legacy v1 emission is not permitted;
- its durable SQLite outbox preserves exact artifact bytes across retries, and
  tests prove canonicalization-before-digest, active-key signing, key-id
  binding, retry byte stability, and clean rejection of malformed records.

The current worker consumer and generic MSA adapter enforce the canonical URL
and strict artifact boundary, but they cannot prove that an absent external
native SQLite producer calculated its semantic digest over canonical records.
That producer-side proof is a release gate, not an assumption that can be
reconstructed from this repository.

## Recovery rehearsal

Run recovery only in a disposable clone with no runtime secrets. Set paths locally; do not store their absolute values in Git.

```bash
set -eu
umask 077

BUNDLE_DIR=/path/to/secured/msa-integration
SOURCE_REPO=/path/to/governed/marcsmusic-site
SOURCE_HEAD=0040b3eb9458e0f30dd73345fa156b2e66b40a20
RESTORE_DIR="$(mktemp -d)"

printf '%s  %s\n' \
  8905884b626fe3ee6e4afa76952ef616064c3349e1d3b7918d65a64afc9abe38 "$BUNDLE_DIR/manifest.json" \
  4f6a372720fe11ccb32fd9f2c45e5a835ef9b298ac2bdac92d083e685ea94d2d "$BUNDLE_DIR/msa-outreach.patch" \
  2b26b1e37d7c6a696698b008d44f983b6a366e656f9cf1374e34e449a9ae3f72 "$BUNDLE_DIR/msa-outreach-files.tar.gz" \
  | shasum -a 256 -c -

jq -e '.productionDecision == "NO_GO" and (.files | length == 16)' \
  "$BUNDLE_DIR/manifest.json"
tar -tzf "$BUNDLE_DIR/msa-outreach-files.tar.gz"
gitleaks dir --max-archive-depth 2 --max-decode-depth 3 --redact=100 \
  "$BUNDLE_DIR"

git clone --shared --no-checkout "$SOURCE_REPO" "$RESTORE_DIR/repo"
git -C "$RESTORE_DIR/repo" checkout --detach "$SOURCE_HEAD"
git -C "$RESTORE_DIR/repo" apply --check "$BUNDLE_DIR/msa-outreach.patch"
git -C "$RESTORE_DIR/repo" apply --3way --index "$BUNDLE_DIR/msa-outreach.patch"
git -C "$RESTORE_DIR/repo" diff --cached --check

cd "$RESTORE_DIR/repo/services/music-submission-agent"
npm ci
npm run lint
npm test
npm run build
```

Successful recovery proves artifact integrity only. It does not remove the NO-GO decision or authorize import into `main`, a push, a deployment, secret configuration, or production sending.
