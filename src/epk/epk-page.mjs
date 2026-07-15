import { createHash } from "node:crypto";

const STYLE = `
:root{color-scheme:dark;--bg:#0b0b0b;--panel:#151515;--ink:#f5f3ee;--muted:#b8b3a9;--accent:#d9ff43;--line:#303030;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);line-height:1.55}a{color:inherit}.shell{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:36px 0 64px}.eyebrow{margin:0 0 10px;color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,420px);gap:42px;align-items:center;padding:28px 0 48px;border-bottom:1px solid var(--line)}h1{margin:0;font-size:clamp(2.5rem,8vw,6.4rem);line-height:.9;letter-spacing:-.055em}.artist{display:block;margin-top:16px;color:var(--muted);font-size:clamp(1.1rem,2.5vw,1.7rem);font-weight:500;letter-spacing:0}.artwork{display:block;width:100%;aspect-ratio:1;object-fit:cover;border:1px solid var(--line);background:var(--panel)}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}.button{display:inline-flex;align-items:center;min-height:44px;padding:10px 16px;border:1px solid var(--accent);background:var(--accent);color:#080808;font-weight:800;text-decoration:none}.button.secondary{background:transparent;color:var(--ink);border-color:var(--line)}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px;padding-top:30px}.card{grid-column:span 6;padding:24px;border:1px solid var(--line);background:var(--panel)}.card.wide{grid-column:span 12}.card h2{margin:0 0 16px;font-size:1rem;letter-spacing:.08em;text-transform:uppercase}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0}.facts div{padding-bottom:12px;border-bottom:1px solid var(--line)}dt{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em}dd{margin:4px 0 0;font-weight:700}.tags{display:flex;flex-wrap:wrap;gap:8px}.tag{padding:5px 9px;border:1px solid var(--line);color:var(--muted);font-size:.88rem}.bio,.restrictions{white-space:pre-line}.download-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}.download-list a{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--line);font-weight:700;text-decoration:none}.meta{color:var(--muted);font-size:.88rem}.footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:18px;margin-top:30px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:.82rem}@media(max-width:760px){.hero{grid-template-columns:1fr}.hero figure{order:-1;margin:0}.card{grid-column:span 12}.facts{grid-template-columns:1fr}}
`.trim();

export const EPK_STYLE_CSP_HASH = `'sha256-${createHash("sha256").update(STYLE).digest("base64")}'`;

const USE_LABELS = Object.freeze({
  "editorial-review": "Editorial review",
  "radio-evaluation": "Radio evaluation",
  "radio-airplay": "Radio airplay"
});

export function renderEpkPage({ release, manifestGeneratedAt, siteOrigin }) {
  const canonicalUrl = new URL(`/epk/${release.slug}`, siteOrigin).href;
  const jsonUrl = new URL(`/api/epk/${release.slug}`, siteOrigin).href;
  const tempo = release.tempo.kind === "bpm" ? `${release.tempo.bpm} BPM` : tempoReason(release.tempo.reason);
  const downloads = Object.entries(release.downloads).map(([key, download]) => `
    <li><a href="${escapeAttribute(download.url)}" download rel="noopener noreferrer"><span>${escapeHtml(download.label)}</span><span class="meta">${escapeHtml(download.format.toUpperCase())}${key === "radioEdit" ? " · Radio edit" : ""}</span></a></li>`).join("");
  const labelName = release.label.website
    ? `<a href="${escapeAttribute(release.label.website)}" rel="noopener noreferrer">${escapeHtml(release.label.name)}</a>`
    : escapeHtml(release.label.name);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(release.artist)} — ${escapeHtml(release.title)} · EPK</title>
  <meta name="description" content="Official electronic press kit for ${escapeAttribute(release.artist)} — ${escapeAttribute(release.title)}.">
  <meta property="og:type" content="music.song">
  <meta property="og:title" content="${escapeAttribute(release.artist)} — ${escapeAttribute(release.title)}">
  <meta property="og:image" content="${escapeAttribute(new URL(release.artwork.url, siteOrigin).href)}">
  <link rel="canonical" href="${escapeAttribute(canonicalUrl)}">
  <style>${STYLE}</style>
</head>
<body>
  <main class="shell">
    <section class="hero" aria-labelledby="release-title">
      <div>
        <p class="eyebrow">Official electronic press kit</p>
        <h1 id="release-title">${escapeHtml(release.title)}<span class="artist">${escapeHtml(release.artist)}</span></h1>
        <div class="actions">
          <a class="button" href="${escapeAttribute(release.publicStream.url)}" rel="noopener noreferrer">Listen on ${escapeHtml(release.publicStream.provider)}</a>
          <a class="button secondary" href="${escapeAttribute(release.spotifyUrl)}" rel="noopener noreferrer">Open in Spotify</a>
          <a class="button secondary" href="#downloads">Download audio</a>
        </div>
      </div>
      <figure><img class="artwork" src="${escapeAttribute(release.artwork.url)}" alt="${escapeAttribute(release.artwork.alt)}" width="900" height="900"></figure>
    </section>

    <div class="grid">
      <section class="card" aria-labelledby="release-details">
        <h2 id="release-details">Release details</h2>
        <dl class="facts">
          <div><dt>Release date</dt><dd>${escapeHtml(release.releaseDate)}</dd></div>
          <div><dt>ISRC</dt><dd>${escapeHtml(release.isrc)}</dd></div>
          <div><dt>Tempo</dt><dd>${escapeHtml(tempo)}</dd></div>
          <div><dt>Instrumental</dt><dd>${release.instrumental ? "Yes" : "No"}</dd></div>
          <div><dt>Label</dt><dd>${labelName}</dd></div>
          <div><dt>Stream access</dt><dd>Public</dd></div>
        </dl>
        <p class="meta">Genres</p>
        <div class="tags" aria-label="Genres">${release.genres.map((genre) => `<span class="tag">${escapeHtml(genre)}</span>`).join("")}</div>
        <p class="meta">Moods</p>
        <div class="tags" aria-label="Moods">${release.moods.map((mood) => `<span class="tag">${escapeHtml(mood)}</span>`).join("")}</div>
      </section>

      <section class="card" aria-labelledby="artist-bio">
        <h2 id="artist-bio">Artist biography</h2>
        <p class="bio">${escapeHtml(release.artistBio.text)}</p>
        <p class="meta">Rights status: artist/label owned.</p>
      </section>

      <section class="card" id="downloads" aria-labelledby="download-title">
        <h2 id="download-title">Downloads</h2>
        <ul class="download-list">${downloads}</ul>
        <p class="meta">Grant: promotional use. Approved for ${escapeHtml(release.downloadRights.allowedUses.map((use) => USE_LABELS[use]).join(", "))}.</p>
        <p class="restrictions">${escapeHtml(release.downloadRights.restrictions)}</p>
        <p class="meta">Rights owner: ${escapeHtml(release.downloadRights.owner)}</p>
      </section>

      <section class="card" aria-labelledby="press-contact">
        <h2 id="press-contact">Label &amp; contact</h2>
        <p><strong>${labelName}</strong></p>
        <p>${escapeHtml(release.contact.name)} · ${escapeHtml(release.contact.role)}<br><a href="mailto:${escapeAttribute(release.contact.email)}">${escapeHtml(release.contact.email)}</a></p>
      </section>

      <section class="card wide" aria-labelledby="provenance">
        <h2 id="provenance">Source &amp; evidence</h2>
        <p>${escapeHtml(release.evidence.statement)}</p>
        <p class="meta">Evidence captured ${escapeHtml(release.evidence.capturedAt)} · <a href="${escapeAttribute(release.evidence.sourceUrl)}" rel="noopener noreferrer">Source</a></p>
      </section>
    </div>

    <footer class="footer"><span>Manifest generated ${escapeHtml(manifestGeneratedAt)}</span><a href="${escapeAttribute(jsonUrl)}">Machine-readable JSON</a></footer>
  </main>
</body>
</html>`;
}

export function contentSecurityPolicyForRelease(release, siteOrigin) {
  const artworkOrigin = new URL(release.artwork.url, siteOrigin).origin;
  const imageSources = artworkOrigin === new URL(siteOrigin).origin ? ["'self'"] : ["'self'", artworkOrigin];
  return [
    "default-src 'none'",
    `style-src ${EPK_STYLE_CSP_HASH}`,
    `img-src ${imageSources.join(" ")}`,
    "script-src 'none'",
    "connect-src 'none'",
    "media-src 'none'",
    "font-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}

function tempoReason(reason) {
  return ({
    "no-fixed-tempo": "No fixed tempo",
    "spoken-word": "Spoken word / tempo not applicable",
    "tempo-not-applicable": "Tempo not applicable"
  })[reason] ?? "Tempo not applicable";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/gu, "&#96;");
}
