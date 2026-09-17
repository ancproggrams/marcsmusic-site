# Public EPK contract and activation runbook

The MarcsMusic website can serve a server-rendered electronic press kit at:

- `GET|HEAD /epk/:slug` — public HTML;
- `GET|HEAD /api/epk/:slug` — the same release as machine-readable JSON.

The feature is disabled unless `EPK_MANIFEST_ROOT` and `EPK_MANIFEST_PATH` identify an audited JSON manifest. A missing or invalid first manifest does not prevent Railway startup: EPK routes return `404` and `/api/health` reports `capabilities.epk=false`. If a later reload fails while a snapshot remains available, health keeps `epk=true` and reports `epkStale=true`.

## Public contract

Manifest schema `1.0` is strict. Unknown and missing properties are rejected. Every release requires:

- URL-safe unique slug, artist, title and real `YYYY-MM-DD` release date;
- one or more genres and one or more moods;
- `instrumental` as an explicit boolean;
- an integer BPM between 20 and 300, or `tempo.kind=not-applicable` with an approved explicit reason;
- canonical 12-character ISRC without separators;
- an artist biography whose rights value is exactly `owned`;
- artwork, an explicitly public listening URL and a distinct Spotify URL;
- MP3 plus either WAV or a radio-edit download;
- a `promotional-use` rights grant, approved uses, owner and restrictions;
- label and public press/contact details;
- source URL, evidence statement and capture timestamp.

HTML-like text, control characters, credentials in URLs, query strings, fragments, encoded traversal, non-HTTPS external URLs and non-allow-listed origins are rejected. Query strings are intentionally forbidden so signed/private stream and download tokens cannot enter the public manifest. The renderer also escapes every text and attribute value.

The committed [example manifest](../examples/epk-manifest.example.json) uses only reserved `example.test` addresses and fictional placeholder metadata. It contains `exampleOnly=true`; the production loader will never activate it.

## Railway configuration

Mount or reuse a persistent volume and set:

```text
EPK_MANIFEST_ROOT=/data/epk
EPK_MANIFEST_PATH=/data/epk/public-epk-manifest.json
EPK_ALLOWED_HTTPS_ORIGINS=https://open.spotify.com,https://approved-media.example,https://approved-evidence.example
EPK_PUBLIC_ASSET_PREFIXES=/assets/epk/
```

`EPK_ALLOWED_HTTPS_ORIGINS` must contain exact HTTPS origins, without paths; include `https://open.spotify.com` when the audited Spotify link uses that host. Do not copy the other illustrative origins above into production. Same-origin asset URLs are limited to `EPK_PUBLIC_ASSET_PREFIXES`; the actual files must be present in the website’s public static asset tree.

The manifest is limited to 256 KiB and 100 releases. The loader rejects symlinked files and out-of-root paths. It checks for a replacement at most once per second. A valid replacement becomes live atomically. If a later read or validation fails, the process keeps serving its last-known-good snapshot and marks it stale internally; manifest errors contain codes, not manifest values or contact details.

## Build and validate

Validate an audited input without writing:

```bash
EPK_ALLOWED_HTTPS_ORIGINS=https://media-approved.example,https://evidence-approved.example \
  npm run epk:validate -- --input /secure/review/epk-input.json
```

Validate the fictional committed example explicitly:

```bash
EPK_ALLOWED_HTTPS_ORIGINS=https://media.example.test,https://evidence.example.test \
  npm run epk:validate -- --input examples/epk-manifest.example.json --allow-example
```

Publish a production manifest using an fsync-and-rename atomic replacement:

```bash
EPK_MANIFEST_ROOT=/data/epk \
EPK_ALLOWED_HTTPS_ORIGINS=https://media-approved.example,https://evidence-approved.example \
  npm run epk:build -- \
  --input /secure/review/epk-input.json \
  --output /data/epk/public-epk-manifest.json
```

The builder refuses output outside `EPK_MANIFEST_ROOT`, symlink destinations, invalid metadata and `exampleOnly` manifests unless `--allow-example` was explicitly supplied. Never use `--allow-example` for the configured production path.

## Exact outreach activation blocker

Website availability is not release authorization. For each release, **all** checks below are mandatory before the corresponding EspoCRM `MusicRelease` may transition from `Draft` to `Active` or be enqueued for outreach:

1. The production manifest passes the builder without `--allow-example`.
2. The owned biography, ISRC, genres/moods, label/contact details, usage grant and source evidence have been reviewed and approved.
3. Artwork, public stream, Spotify, MP3 and WAV/radio-edit URLs return public `2xx` responses without credentials, query tokens or private redirects.
4. `/epk/:slug` and `/api/epk/:slug` both return `200`, contain the expected ISRC and expose the documented CSP/cache/security headers.
5. `/api/health` reports `capabilities.epk=true`.
6. The exact public `/epk/:slug` URL is stored as the release EPK URL in EspoCRM and passes the outreach link-reachability gate.

If any check fails, that release must remain non-active and outreach eligibility must remain denied. The website module never changes EspoCRM release status and never enables sending; those controls remain fail-closed in the outreach system.

To retire a published release, deploy an audited replacement manifest that omits it. Do not delete or corrupt the file as a retirement mechanism, because fail-last-known-good deliberately preserves the previous snapshot during incidents.

## Response controls

Successful HTML and JSON responses include strong ETags, `Last-Modified`, conditional `304` handling and a short public cache policy. EPK HTML contains no script, uses a hash-authorized static style block, and sends a restrictive CSP plus COOP, CORP, permissions, referrer, MIME-sniffing and framing protections. Not-found responses are `no-store`.

These repository controls demonstrate technical behavior; they do not establish copyright ownership, consent, licensing approval or ISO certification.
