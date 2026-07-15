const SITE_ORIGIN = "https://epk.public.test";
const MEDIA_ORIGIN = "https://media.public.test";
const EVIDENCE_ORIGIN = "https://evidence.public.test";
const SPOTIFY_ORIGIN = "https://open.spotify.com";
const SLUG = "verified-release";

export function createEpkServiceFixture() {
  const approvedOrigins = new Set([SITE_ORIGIN, MEDIA_ORIGIN, EVIDENCE_ORIGIN, SPOTIFY_ORIGIN]);
  const routes = Object.freeze({
    htmlUrl: `${SITE_ORIGIN}/epk/${SLUG}`,
    jsonUrl: `${SITE_ORIGIN}/api/epk/${SLUG}`,
    healthUrl: `${SITE_ORIGIN}/api/health`
  });
  const state = {
    manifest: manifestFixture(),
    health: { status: "ok", capabilities: { epk: true, epkStale: false } },
    responses: new Map(),
    dns: new Map(),
    calls: []
  };
  const assetHeaders = new Map([
    [`${MEDIA_ORIGIN}/verified-release.jpg`, { "content-type": "image/jpeg", "content-length": "204800" }],
    [`${MEDIA_ORIGIN}/verified-release-stream`, { "content-type": "text/html; charset=utf-8", "content-length": "4096" }],
    [`${MEDIA_ORIGIN}/verified-release.mp3`, { "content-type": "audio/mpeg", "content-length": "7340032" }],
    [`${MEDIA_ORIGIN}/verified-release.wav`, { "content-type": "audio/wav", "content-length": "44040192" }]
  ]);

  async function lookup(hostname) {
    return clone(state.dns.get(hostname) ?? [{ address: "93.184.216.34", family: 4 }]);
  }

  async function request(options) {
    state.calls.push(Object.freeze({
      url: options.url.href,
      method: options.method,
      address: options.address,
      family: options.family,
      headers: { ...(options.headers ?? {}) }
    }));
    const override = state.responses.get(`${options.method} ${options.url.href}`);
    if (override) return typeof override === "function" ? override(options) : cloneResponse(override);
    if (options.method === "GET" && options.url.href === routes.healthUrl) return jsonResponse(state.health);
    if (options.method === "GET" && options.url.href === routes.jsonUrl) return jsonResponse(state.manifest);
    if (options.method === "GET" && options.url.href === routes.htmlUrl) return htmlResponse(htmlFixture(state.manifest.release, routes));
    const headers = assetHeaders.get(options.url.href);
    if (headers && options.method === "HEAD") return response(200, headers);
    if (headers && options.method === "GET") {
      const total = headers["content-length"];
      return response(206, { ...headers, "content-length": "1", "content-range": `bytes 0-0/${total}` }, Buffer.from("0"));
    }
    return response(404, { "content-type": "text/plain", "content-length": "0" });
  }

  return Object.freeze({
    approvedOrigins,
    routes,
    lookup,
    request,
    calls: state.calls,
    get manifest() { return clone(state.manifest); },
    setManifest(value) { state.manifest = clone(value); },
    setHealth(value) { state.health = clone(value); },
    setDns(hostname, records) { state.dns.set(hostname, clone(records)); },
    setResponse(method, url, value) { state.responses.set(`${method} ${url}`, value); },
    clearCalls() { state.calls.length = 0; }
  });
}

export function musicReleaseFixture(overrides = {}) {
  return {
    id: "release-epk-1",
    versionNumber: 7,
    status: "Draft",
    epkUrl: `${SITE_ORIGIN}/epk/${SLUG}`,
    isrc: "NL-ABC-26-00001",
    artistName: "MarcsMusic",
    name: "Verified Release",
    releaseDate: "2026-07-24",
    genres: ["Dance", "Electronic"],
    moods: ["Energetic", "Uplifting"],
    bpm: 124,
    instrumental: false,
    artworkUrl: `${MEDIA_ORIGIN}/verified-release.jpg`,
    spotifyUrl: `${SPOTIFY_ORIGIN}/track/0123456789ABCDEFGHIJKL`,
    downloadUrl: `${MEDIA_ORIGIN}/verified-release.mp3`,
    radioEditUrl: null,
    privateStreamUrl: `${MEDIA_ORIGIN}/verified-release-stream`,
    epkAttestationState: "Unverified",
    epkManifestSha256: null,
    epkVerifiedAt: null,
    epkEvidenceReference: null,
    ...overrides
  };
}

export function manifestFixture() {
  return {
    schemaVersion: "1.0",
    generatedAt: "2026-07-15T10:00:00.000Z",
    release: {
      slug: SLUG,
      artist: "MarcsMusic",
      title: "Verified Release",
      releaseDate: "2026-07-24",
      genres: ["Dance", "Electronic"],
      moods: ["Energetic", "Uplifting"],
      instrumental: false,
      tempo: { kind: "bpm", bpm: 124 },
      isrc: "NLABC2600001",
      artistBio: {
        text: "MarcsMusic is the rights-owning artist for this complete public electronic press kit.",
        rights: "owned"
      },
      artwork: { url: `${MEDIA_ORIGIN}/verified-release.jpg`, alt: "Verified Release cover artwork" },
      publicStream: { url: `${MEDIA_ORIGIN}/verified-release-stream`, provider: "MarcsMusic", access: "public" },
      spotifyUrl: `${SPOTIFY_ORIGIN}/track/0123456789ABCDEFGHIJKL`,
      downloads: {
        mp3: { url: `${MEDIA_ORIGIN}/verified-release.mp3`, format: "mp3", label: "Promotional MP3" },
        wav: { url: `${MEDIA_ORIGIN}/verified-release.wav`, format: "wav", label: "Broadcast WAV" }
      },
      downloadRights: {
        owner: "MarcsMusic",
        grant: "promotional-use",
        allowedUses: ["editorial-review", "radio-evaluation"],
        restrictions: "Use only for approved editorial review or radio evaluation."
      },
      label: { name: "MarcsMusic", website: `${EVIDENCE_ORIGIN}/label` },
      contact: { name: "Press Desk", role: "Press contact", email: "press@example.test" },
      evidence: {
        sourceUrl: `${EVIDENCE_ORIGIN}/release/verified-release`,
        capturedAt: "2026-07-15T09:00:00.000Z",
        statement: "Owned source evidence confirms the release metadata and public asset rights."
      }
    }
  };
}

export function response(statusCode, headers = {}, body = Buffer.alloc(0)) {
  return Object.freeze({ statusCode, headers: { ...headers }, body: Buffer.from(body) });
}

function jsonResponse(value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return response(200, { "content-type": "application/json; charset=utf-8", "content-length": String(body.byteLength) }, body);
}

function htmlResponse(value) {
  const body = Buffer.from(value, "utf8");
  return response(200, { "content-type": "text/html; charset=utf-8", "content-length": String(body.byteLength) }, body);
}

function htmlFixture(release, routes) {
  return `<!doctype html><html><head><link rel="canonical" href="${routes.htmlUrl}"></head><body>`
    + `<h1 id="release-title">${release.title}<span>${release.artist}</span></h1>`
    + `<dl><div><dt>ISRC</dt><dd>${release.isrc}</dd></div></dl>`
    + `<a href="${routes.jsonUrl}">Machine-readable JSON</a></body></html>`;
}

function clone(value) {
  return structuredClone(value);
}

function cloneResponse(value) {
  return response(value.statusCode, clone(value.headers), value.body);
}
