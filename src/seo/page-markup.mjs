import {
  absoluteUrl,
  buildJsonLdGraph,
  canonicalUrl,
  faqEntriesForPage,
  getPage,
  SITE_ENTITY,
  SITE_LOCALE
} from "./site-seo.mjs";

export const HEAD_REGION = Object.freeze({ start: "<!-- seo:head:start -->", end: "<!-- seo:head:end -->" });
export const FAQ_REGION = Object.freeze({ start: "<!-- seo:faq:start -->", end: "<!-- seo:faq:end -->" });

const TWITTER_HANDLE = "@MarcsMusic_";
const ROBOTS_DIRECTIVES = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

/**
 * Renders the generated part of a page head: canonical identity, sharing
 * metadata and the JSON-LD graph. The region markers let
 * `scripts/sync-seo-metadata.mjs` rewrite exactly this block, so the pages
 * cannot drift away from the entity data in `site-seo.mjs`.
 */
export function buildHeadMarkup({ pageId, siteOrigin, indent = "    " }) {
  const page = getPage(pageId);
  const canonical = canonicalUrl(siteOrigin, page);
  const share = SITE_ENTITY.shareImage;
  const imageUrl = absoluteUrl(siteOrigin, share.path);
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    meta("name", "description", page.description),
    `<link rel="canonical" href="${escapeAttribute(canonical)}">`,
    meta("name", "robots", ROBOTS_DIRECTIVES),
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", SITE_ENTITY.name),
    meta("property", "og:locale", SITE_LOCALE),
    meta("property", "og:title", page.title),
    meta("property", "og:description", page.description),
    meta("property", "og:url", canonical),
    meta("property", "og:image", imageUrl),
    meta("property", "og:image:width", String(share.width)),
    meta("property", "og:image:height", String(share.height)),
    meta("property", "og:image:alt", share.alt),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:site", TWITTER_HANDLE),
    meta("name", "twitter:title", page.title),
    meta("name", "twitter:description", page.description),
    meta("name", "twitter:image", imageUrl),
    meta("name", "twitter:image:alt", share.alt)
  ];

  const jsonLd = JSON.stringify(buildJsonLdGraph({ pageId, siteOrigin }), null, 2)
    .split("\n")
    .map((line) => `${indent}  ${line}`)
    .join("\n");

  return [
    `${indent}${HEAD_REGION.start}`,
    ...tags.map((tag) => `${indent}${tag}`),
    `${indent}<script type="application/ld+json">`,
    jsonLd,
    `${indent}</script>`,
    `${indent}${HEAD_REGION.end}`
  ].join("\n");
}

/**
 * Renders the visible answer blocks from the same FAQ data that feeds the
 * `FAQPage` graph, because an answer engine should only find answers that a
 * visitor can read on the page itself.
 */
export function buildFaqMarkup({ pageId, indent = "      " }) {
  const entries = faqEntriesForPage(pageId);
  if (!entries.length) throw new Error(`No FAQ entries are defined for page: ${pageId}`);

  const items = entries.flatMap((entry) => [
    `${indent}  <article class="faq-item" id="vraag-${escapeAttribute(entry.id)}">`,
    `${indent}    <h3>${escapeHtml(entry.question)}</h3>`,
    `${indent}    <p>${escapeHtml(entry.answer)}</p>`,
    `${indent}  </article>`
  ]);

  return [
    `${indent}${FAQ_REGION.start}`,
    `${indent}<div class="faq-list" data-reveal>`,
    ...items,
    `${indent}</div>`,
    `${indent}${FAQ_REGION.end}`
  ].join("\n");
}

export function readRegion(html, region) {
  const { start, end } = locateRegion(html, region);
  return html.slice(start, end);
}

export function replaceRegion(html, region, markup) {
  const { start, end } = locateRegion(html, region);
  return html.slice(0, start) + markup + html.slice(end);
}

function locateRegion(html, region) {
  const startMarker = html.indexOf(region.start);
  const endMarker = html.indexOf(region.end);
  if (startMarker === -1 || endMarker === -1 || endMarker < startMarker) {
    throw new Error(`The page is missing the ${region.start} / ${region.end} region.`);
  }

  return { start: html.lastIndexOf("\n", startMarker) + 1, end: endMarker + region.end.length };
}

function meta(attribute, name, content) {
  return `<meta ${attribute}="${escapeAttribute(name)}" content="${escapeAttribute(content)}">`;
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
