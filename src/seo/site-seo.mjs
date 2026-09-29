import { TRACKS } from "../../app.js";

export const SITE_LANGUAGE = "nl-NL";
export const SITE_LOCALE = "nl_NL";

export const SITE_ENTITY = Object.freeze({
  name: "MarcsMusic",
  makerName: "Marc",
  summary:
    "MarcsMusic is het muziekproject van Marc: eigen Nederlandse tracks om te beluisteren en een online boeking voor een DJ-set, event of studiosessie.",
  logoPath: "/assets/logo-black-transparent.png",
  portraitPath: "/assets/portrait-full.png",
  countryCode: "NL",
  countryName: "Nederland",
  timeZone: "Europe/Amsterdam",
  sameAs: Object.freeze([
    "https://www.instagram.com/marcsmusic_1/",
    "https://x.com/MarcsMusic_",
    "https://open.spotify.com/playlist/7MAFBX5fE0YFGY1bS3auhy"
  ])
});

/**
 * `lastModified` is curated on purpose. Deploy timestamps or file mtimes would
 * announce freshness that the content does not have, so bump the date only
 * together with a meaningful content change on that page.
 */
export const SITE_PAGES = Object.freeze([
  Object.freeze({
    id: "home",
    path: "/",
    file: "index.html",
    title: "MarcsMusic — eigen muziek van Marc, luisteren en boeken",
    description:
      "Beluister alle acht tracks van MarcsMusic en lees het verhaal van Marc achter de muziek. Boek daarna direct een DJ-set, event of studiosessie.",
    imagePath: SITE_ENTITY.portraitPath,
    imageAlt: "Portret van Marc van MarcsMusic",
    lastModified: "2026-09-29",
    changeFrequency: "weekly",
    priority: "1.0"
  }),
  Object.freeze({
    id: "booking",
    path: "/booking",
    file: "booking.html",
    title: "MarcsMusic boeken: DJ-set, event of studiosessie",
    description:
      "Boek MarcsMusic voor een DJ-set, event of studiosessie. Kies datum en tijd uit de live agenda, zie duur en prijs vooraf en rond veilig af.",
    imagePath: SITE_ENTITY.portraitPath,
    imageAlt: "Portret van Marc van MarcsMusic",
    lastModified: "2026-09-29",
    changeFrequency: "monthly",
    priority: "0.9"
  })
]);

export const BOOKING_SERVICES = Object.freeze([
  Object.freeze({
    id: "dj-set",
    name: "DJ-set door MarcsMusic",
    serviceType: "DJ-set",
    description:
      "Een DJ-set voor een feest of moment dat energie en een eigen muzikale lijn nodig heeft, met een set die op de avond is afgestemd."
  }),
  Object.freeze({
    id: "event-muziek",
    name: "Eventmuziek door MarcsMusic",
    serviceType: "Muziek voor events",
    description:
      "Muziek voor een event, afgestemd op de sfeer en de opbouw van het programma, van ontvangst tot het laatste programmaonderdeel."
  }),
  Object.freeze({
    id: "studiosessie",
    name: "Studiosessie met MarcsMusic",
    serviceType: "Studiosessie",
    description:
      "Een studiosessie om samen aan muziek, ideeën en een concrete opname te werken, met ruimte voor eigen inbreng."
  })
]);

/**
 * Answer-engine blocks. Every answer must stay self-contained, name the entity
 * and describe behaviour instead of tunable numbers: prices, lead times and
 * travel rates are environment configuration and would otherwise drift out of
 * sync with the running booking module.
 */
export const FAQ_ENTRIES = Object.freeze([
  Object.freeze({
    id: "hoe-boeken",
    pageId: "booking",
    question: "Hoe boek je MarcsMusic voor een DJ-set of event?",
    answer:
      "Kies op de boekingspagina van MarcsMusic het type boeking, selecteer een datum en tijd uit de live agenda, vul je gegevens in en rond de betaling af. Je blijft daarbij op dezelfde pagina."
  }),
  Object.freeze({
    id: "soorten-boekingen",
    pageId: "booking",
    question: "Welke soorten boekingen zijn mogelijk bij MarcsMusic?",
    answer:
      "MarcsMusic is te boeken als DJ-set voor een feest, als muziek voor een event en voor een studiosessie. Elk type heeft een eigen duur en prijs, die je in de boekingsmodule ziet voordat je betaalt."
  }),
  Object.freeze({
    id: "prijs",
    pageId: "booking",
    question: "Wat kost het om MarcsMusic te boeken?",
    answer:
      "De prijs hangt af van het type boeking, het aantal aansluitende blokken en de reisuren binnen Nederland. Het overzicht in de boekingsmodule toont de boekingskosten, de reiskosten en het totaal exclusief btw voordat je afrondt."
  }),
  Object.freeze({
    id: "beschikbaarheid",
    pageId: "booking",
    question: "Is de beschikbaarheid van MarcsMusic actueel?",
    answer:
      "Ja. De kalender leest de officiële MarcsMusic-agenda in de tijdzone Europe/Amsterdam en toont alleen tijden die daadwerkelijk vrij zijn, inclusief de ingestelde speling tussen twee boekingen."
  }),
  Object.freeze({
    id: "reiskosten",
    pageId: "booking",
    question: "Hoe worden de reiskosten van MarcsMusic berekend?",
    answer:
      "Reiskosten gelden voor reizen binnen Nederland en worden per heel reisuur gerekend. Je vult de reisuren zelf in en het overzicht rekent ze direct mee in het totaal."
  }),
  Object.freeze({
    id: "betalen",
    pageId: "booking",
    question: "Hoe betaal je een boeking bij MarcsMusic?",
    answer:
      "Betalen gebeurt online aan het einde van de boekingsstappen via de betaalprovider Mollie. Je gegevens worden alleen gebruikt om deze boeking en betaling af te handelen."
  }),
  Object.freeze({
    id: "definitief",
    pageId: "booking",
    question: "Wanneer staat een boeking bij MarcsMusic definitief vast?",
    answer:
      "De gekozen tijd wordt tijdelijk vastgehouden zodra je de boeking start. De boeking is definitief en komt in de agenda zodra de betaling als betaald is bevestigd; blijft die bevestiging uit, dan komt de tijd weer vrij."
  }),
  Object.freeze({
    id: "luisteren",
    pageId: "booking",
    question: "Waar kun je de muziek van MarcsMusic beluisteren?",
    answer:
      "Alle acht tracks staan volledig op marcsmusic.nl en dezelfde playlist is ook via Spotify te openen. Beluisteren kan zonder account en zonder de boekingsstappen te starten."
  })
]);

export function getPage(pageId) {
  const page = SITE_PAGES.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`Unknown SEO page: ${pageId}`);
  return page;
}

export function faqEntriesForPage(pageId) {
  return FAQ_ENTRIES.filter((entry) => entry.pageId === pageId);
}

export function absoluteUrl(siteOrigin, path) {
  return new URL(path, ensureOrigin(siteOrigin)).href;
}

export function canonicalUrl(siteOrigin, page) {
  return absoluteUrl(siteOrigin, page.path);
}

export function isoDuration(seconds) {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) throw new Error("Track duration must be a positive number of seconds.");
  const minutes = Math.floor(total / 60);
  return `PT${minutes}M${total % 60}S`;
}

export function clockDuration(seconds) {
  const total = Math.round(Number(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function trackList() {
  return TRACKS.map((track) => ({
    slug: track.slug,
    title: track.title,
    duration: track.duration,
    coverPath: `/${track.cover.replace(/^\/+/u, "")}`
  }));
}

export function buildJsonLdGraph({ pageId, siteOrigin }) {
  const origin = ensureOrigin(siteOrigin);
  const page = getPage(pageId);
  const graph = [website(origin), artist(origin), webPage(origin, page)];

  if (pageId === "home") {
    graph.push(playlist(origin));
  }

  if (pageId === "booking") {
    graph.push(breadcrumb(origin, page), ...services(origin, page), faqPage(origin, page));
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function website(origin) {
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: SITE_ENTITY.name,
    description: SITE_ENTITY.summary,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": `${origin}/#artist` }
  };
}

function artist(origin) {
  return {
    "@type": "MusicGroup",
    "@id": `${origin}/#artist`,
    name: SITE_ENTITY.name,
    url: `${origin}/`,
    description: SITE_ENTITY.summary,
    image: absoluteUrl(origin, SITE_ENTITY.portraitPath),
    logo: absoluteUrl(origin, SITE_ENTITY.logoPath),
    sameAs: [...SITE_ENTITY.sameAs],
    areaServed: { "@type": "Country", name: SITE_ENTITY.countryName },
    member: { "@type": "Person", name: SITE_ENTITY.makerName, roleName: "Artiest en producer" }
  };
}

function webPage(origin, page) {
  return {
    "@type": "WebPage",
    "@id": `${canonicalUrl(origin, page)}#webpage`,
    url: canonicalUrl(origin, page),
    name: page.title,
    description: page.description,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": `${origin}/#website` },
    about: { "@id": `${origin}/#artist` },
    primaryImageOfPage: absoluteUrl(origin, page.imagePath),
    dateModified: page.lastModified
  };
}

function playlist(origin) {
  const tracks = trackList();
  return {
    "@type": "MusicPlaylist",
    "@id": `${origin}/#playlist`,
    name: `Alle tracks van ${SITE_ENTITY.name}`,
    url: `${origin}/#luisteren`,
    numTracks: tracks.length,
    inLanguage: SITE_LANGUAGE,
    track: tracks.map((track) => ({
      "@type": "MusicRecording",
      "@id": `${origin}/#track-${track.slug}`,
      name: track.title,
      duration: isoDuration(track.duration),
      url: `${origin}/#luisteren`,
      image: absoluteUrl(origin, track.coverPath),
      byArtist: { "@id": `${origin}/#artist` }
    }))
  };
}

function breadcrumb(origin, page) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl(origin, page)}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Luisteren", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Boeken", item: canonicalUrl(origin, page) }
    ]
  };
}

function services(origin, page) {
  return BOOKING_SERVICES.map((service) => ({
    "@type": "Service",
    "@id": `${canonicalUrl(origin, page)}#${service.id}`,
    name: service.name,
    serviceType: service.serviceType,
    description: service.description,
    provider: { "@id": `${origin}/#artist` },
    areaServed: { "@type": "Country", name: SITE_ENTITY.countryName },
    availableChannel: {
      "@type": "ServiceChannel",
      name: "Online boeking",
      serviceUrl: canonicalUrl(origin, page),
      availableLanguage: { "@type": "Language", name: "Nederlands" }
    }
  }));
}

function faqPage(origin, page) {
  return {
    "@type": "FAQPage",
    "@id": `${canonicalUrl(origin, page)}#faq`,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": `${canonicalUrl(origin, page)}#webpage` },
    mainEntity: faqEntriesForPage(page.id).map((entry) => ({
      "@type": "Question",
      "@id": `${canonicalUrl(origin, page)}#vraag-${entry.id}`,
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer }
    }))
  };
}

function ensureOrigin(siteOrigin) {
  const url = new URL(String(siteOrigin));
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The SEO site origin may not contain credentials, a query or a fragment.");
  }
  return url.origin;
}
