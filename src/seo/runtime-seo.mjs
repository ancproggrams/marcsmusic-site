import { canonicalUrl, getPage, SITE_ENTITY, serviceForBookingType } from "./site-seo.mjs";

export const RUNTIME_MARKER = "<!-- seo:runtime -->";

const VERIFICATION_PROVIDERS = Object.freeze([
  { key: "google", metaName: "google-site-verification", environmentName: "GOOGLE_SITE_VERIFICATION" },
  { key: "bing", metaName: "msvalidate.01", environmentName: "BING_SITE_VERIFICATION" }
]);

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/u;

/**
 * Prices and durations live in the booking configuration, so publishing them as
 * structured data only stays truthful when the graph is rendered from that same
 * configuration at request time instead of being written into the static page.
 */
export function buildBookingOfferGraph({ siteOrigin, bookingConfig }) {
  const page = getPage("booking");
  const bookingUrl = canonicalUrl(siteOrigin, page);
  const currency = requireCurrency(bookingConfig.currency);
  const skippedTypeIds = [];
  const offers = [];

  for (const type of bookingConfig.bookingTypes || []) {
    const service = serviceForBookingType(type.id);
    if (!service) {
      skippedTypeIds.push(String(type.id));
      continue;
    }

    offers.push({
      "@type": "Offer",
      "@id": `${bookingUrl}#aanbod-${service.id}`,
      name: service.name,
      url: bookingUrl,
      priceCurrency: currency,
      price: amount(type.priceCents),
      valueAddedTaxIncluded: bookingConfig.pricesExcludeVat === true ? false : undefined,
      availability: "https://schema.org/InStock",
      offeredBy: { "@id": `${new URL(siteOrigin).origin}/#artist` },
      itemOffered: { "@id": `${bookingUrl}#${service.id}` },
      eligibleRegion: { "@type": "Country", name: SITE_ENTITY.countryName },
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceCurrency: currency,
        price: amount(type.priceCents),
        valueAddedTaxIncluded: bookingConfig.pricesExcludeVat === true ? false : undefined,
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: requireMinutes(type.durationMinutes),
          unitCode: "MIN"
        }
      },
      addOn: travelOffer(bookingConfig, currency)
    });
  }

  if (!offers.length) {
    return { graph: null, skippedTypeIds };
  }

  return {
    graph: { "@context": "https://schema.org", "@graph": offers.map(pruneUndefined) },
    skippedTypeIds
  };
}

/**
 * Renders the request-time part of a page head: the ownership proofs for search
 * consoles and, on the booking page, the live offer graph.
 */
export function renderRuntimeHead({ pageId, siteOrigin, bookingConfig, verification, indent = "    " }) {
  const lines = verificationMetaTags(verification).map((tag) => `${indent}${tag}`);

  if (pageId === "booking") {
    const { graph } = buildBookingOfferGraph({ siteOrigin, bookingConfig });
    if (graph) {
      const json = JSON.stringify(graph, null, 2)
        .split("\n")
        .map((line) => `${indent}  ${line}`)
        .join("\n");
      lines.push(`${indent}<script type="application/ld+json">`, json, `${indent}</script>`);
    }
  }

  return lines.join("\n");
}

export function verificationMetaTags(verification = {}) {
  return VERIFICATION_PROVIDERS.flatMap((provider) => {
    const token = String(verification[provider.key] || "").trim();
    if (!token) return [];
    if (!TOKEN_PATTERN.test(token)) {
      throw new Error(`${provider.environmentName} must be 8-128 characters of letters, digits, "-" or "_".`);
    }
    return [`<meta name="${provider.metaName}" content="${token}">`];
  });
}

function travelOffer(bookingConfig, currency) {
  const rateCents = bookingConfig.travelRateCentsPerHour;
  if (!Number.isFinite(rateCents) || rateCents <= 0) {
    return undefined;
  }

  return {
    "@type": "Offer",
    name: `Reiskosten per reisuur binnen ${SITE_ENTITY.countryName}`,
    priceCurrency: currency,
    price: amount(rateCents),
    valueAddedTaxIncluded: bookingConfig.pricesExcludeVat === true ? false : undefined,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      priceCurrency: currency,
      price: amount(rateCents),
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "HUR" }
    }
  };
}

function amount(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("A booking price must be a whole, non-negative number of cents.");
  }
  return (cents / 100).toFixed(2);
}

function requireMinutes(minutes) {
  if (!Number.isSafeInteger(minutes) || minutes <= 0) {
    throw new Error("A booking duration must be a positive whole number of minutes.");
  }
  return minutes;
}

function requireCurrency(currency) {
  if (!/^[A-Z]{3}$/u.test(String(currency || ""))) {
    throw new Error("The booking currency must be a three-letter ISO 4217 code.");
  }
  return currency;
}

function pruneUndefined(value) {
  if (Array.isArray(value)) return value.map(pruneUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, pruneUndefined(entry)])
  );
}
