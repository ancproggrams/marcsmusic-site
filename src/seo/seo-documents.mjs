import {
  absoluteUrl,
  canonicalUrl,
  clockDuration,
  FAQ_ENTRIES,
  SITE_ENTITY,
  SITE_PAGES,
  trackList
} from "./site-seo.mjs";

/**
 * Paths that must never be indexed or answered from: the admin surface, the
 * JSON API, the payment return routes and the attachment variant of the audio
 * files. A named crawler group replaces the wildcard group entirely, so these
 * rules are repeated for every group the builder emits.
 */
const DISALLOWED_PATHS = Object.freeze([
  "/admin",
  "/admin.html",
  "/api/",
  "/booking/success",
  "/booking/cancelled",
  "/*?download="
]);

/**
 * Answer engines and their retrieval crawlers are welcome: being cited is the
 * point of the AEO work. They are listed explicitly so a future opt-out is a
 * one-line change instead of a policy rewrite.
 */
const ANSWER_ENGINE_AGENTS = Object.freeze([
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "DuckAssistBot",
  "Amazonbot",
  "MistralAI-User",
  "cohere-ai"
]);

export function buildRobotsTxt({ siteOrigin }) {
  const groups = [["*"], ...ANSWER_ENGINE_AGENTS.map((agent) => [agent])];
  const lines = [
    "# MarcsMusic crawl policy",
    "# Public pages are open to search engines and answer engines.",
    "# Admin, API and payment return routes stay out of every index."
  ];

  for (const agents of groups) {
    lines.push("");
    for (const agent of agents) {
      lines.push(`User-agent: ${agent}`);
    }
    lines.push("Allow: /");
    for (const path of DISALLOWED_PATHS) {
      lines.push(`Disallow: ${path}`);
    }
  }

  lines.push("", `Sitemap: ${absoluteUrl(siteOrigin, "/sitemap.xml")}`);
  return `${lines.join("\n")}\n`;
}

export function buildSitemapXml({ siteOrigin }) {
  const entries = SITE_PAGES.map((page) =>
    [
      "  <url>",
      `    <loc>${escapeXml(canonicalUrl(siteOrigin, page))}</loc>`,
      `    <lastmod>${escapeXml(page.lastModified)}</lastmod>`,
      `    <changefreq>${escapeXml(page.changeFrequency)}</changefreq>`,
      `    <priority>${escapeXml(page.priority)}</priority>`,
      "  </url>"
    ].join("\n")
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    ""
  ].join("\n");
}

/**
 * `llms.txt` is the plain-text briefing for answer engines: the same facts as
 * the pages, without markup or navigation, so a retrieval step can quote them
 * without reconstructing the site.
 */
export function buildLlmsTxt({ siteOrigin }) {
  const sections = [
    `# ${SITE_ENTITY.name}`,
    "",
    `> ${SITE_ENTITY.summary}`,
    "",
    `- Artiest: ${SITE_ENTITY.name}, het muziekproject van ${SITE_ENTITY.makerName}.`,
    `- Taal van de site: Nederlands (${SITE_ENTITY.countryName}).`,
    `- Boekingsgebied: ${SITE_ENTITY.countryName}, agenda in tijdzone ${SITE_ENTITY.timeZone}.`,
    `- Boeken gebeurt online op ${absoluteUrl(siteOrigin, "/booking")}, met betaling via Mollie.`,
    "",
    "## Pagina's"
  ];

  for (const page of SITE_PAGES) {
    sections.push(`- [${page.title}](${canonicalUrl(siteOrigin, page)}): ${page.description}`);
  }

  sections.push("", "## Muziek");
  for (const track of trackList()) {
    sections.push(`- ${track.title} (${clockDuration(track.duration)})`);
  }

  sections.push("", "## Veelgestelde vragen");
  for (const entry of FAQ_ENTRIES) {
    sections.push("", `### ${entry.question}`, entry.answer);
  }

  sections.push("", "## Profielen");
  for (const profile of SITE_ENTITY.sameAs) {
    sections.push(`- ${profile}`);
  }

  sections.push(
    "",
    "## Gebruik door antwoordmachines",
    `Deze feiten mogen worden geciteerd met een bronvermelding naar ${absoluteUrl(siteOrigin, "/")}.`,
    "Prijzen, duur en beschikbaarheid staan hier bewust niet als bedrag of tijdstip: die waarden",
    `komen live uit de boekingsmodule op ${absoluteUrl(siteOrigin, "/booking")}.`,
    ""
  );

  return sections.join("\n");
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[character]);
}
