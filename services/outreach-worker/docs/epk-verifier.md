# EPK verification and activation evidence

The EPK verifier is a default-off, one-shot control between a public EPK and
the EspoCRM `MusicRelease` activation policy. It can inspect one release or a
bounded batch. It accepts only `Draft` and `Paused` records and writes only:

- `epkAttestationState`;
- `epkManifestSha256`;
- `epkVerifiedAt`;
- `epkEvidenceReference`.

It never writes `status` and can therefore never activate a release. A separate
authorized EspoCRM transition may be considered only after a successful
attestation. Keep outreach sending fail-closed during staging verification.

## Public contract

For the exact slug in `MusicRelease.epkUrl`, every run performs bounded `GET`
requests to:

- `/api/health`, which must report `capabilities.epk=true` and
  `capabilities.epkStale=false`;
- `/api/epk/:slug`, which must satisfy the strict public JSON schema;
- `/epk/:slug`, which must be the matching script-free HTML representation.

The verifier then probes artwork, public stream, MP3, WAV and optional radio
edit assets. Rights and public contact fields are mandatory in the EPK schema,
but are not duplicated in `MusicRelease`. The following modeled values are
canonicalized and compared:

| EspoCRM | Public EPK |
| --- | --- |
| `artistName`, `name`, `releaseDate`, `isrc` | artist, title, release date, ISRC |
| `genres`, `moods`, `bpm`, `instrumental` | genres, moods, tempo, instrumental |
| `spotifyUrl`, `artworkUrl` | Spotify track, artwork |
| `downloadUrl`, `radioEditUrl` | MP3, optional radio edit |
| `privateStreamUrl` | public stream |
| `epkUrl` | exact public HTML route |

Same-origin relative manifest asset paths are resolved to canonical absolute
URLs before comparison. The attestation digest is lowercase SHA-256 over the
canonical, normalized JSON contract.

## Network boundary

`EPK_VERIFIER_APPROVED_HTTPS_ORIGINS` is a comma-separated list of exact HTTPS
origins without paths, credentials, query strings, fragments, non-standard
ports or trailing slashes. Include the EPK site, every media/evidence/label
origin and `https://open.spotify.com` when used.

Every request and redirect hop performs a fresh DNS lookup. If any answer is
private, loopback, link-local, reserved, documentation or otherwise non-public,
the run fails. The socket is pinned to the validated address while TLS SNI and
certificate verification retain the original hostname. Redirect count, total
time, headers, JSON, HTML, asset count, probe body and declared asset size are
bounded. Compression, ambiguous security-relevant headers, route changes and
redirects with query tokens fail closed.

## OCC and failure handling

The job reads the release and `versionNumber`, verifies the complete remote
contract, then refetches the manifest and health state immediately before using
`updateConditional`; any mid-run manifest drift or stale health fails closed. A
version conflict causes exactly one complete reread, refetch and recomparison;
it is never a blind write retry.
Success stores `Verified` plus all three proof fields. An eligible release that
fails verification is OCC-written as `Failed` with cleared digest/timestamp and
an opaque failure reference. Logs and command output contain only opaque record
IDs, digests, counts and allowlisted error codes—never EPK content or contact
data.

## Configuration and execution

The `.env.example` values are bounded defaults. Enabling additionally requires
the least-privilege `ESPOCRM_BASE_URL`/`ESPOCRM_API_KEY` identity and a nonempty
origin allowlist.

Verify exactly one release:

```bash
EPK_VERIFIER_ENABLED=true npm run epk:verify -- \
  --release-id <opaque-release-id> \
  --run-id <approved-change-or-job-id>
```

Verify at most the configured batch size (hard maximum 25):

```bash
EPK_VERIFIER_ENABLED=true npm run epk:verify -- \
  --limit 5 \
  --run-id <approved-change-or-job-id>
```

The default without `EPK_VERIFIER_ENABLED=true` is a no-op. Any failed release
makes the CLI exit nonzero. Do not enable or schedule this job in production
until the public EPK, EspoCRM invalidation hook, least-privilege role and a
staging canary have all been independently verified.
