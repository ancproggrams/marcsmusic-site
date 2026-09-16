const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 100;

export async function fetchTransparanteBrokerAssignments({
  baseUrl,
  fetchImpl = fetch,
  pageSize = DEFAULT_PAGE_SIZE,
  timeoutMs = 15_000
}) {
  const assignments = [];
  let expectedTotal = null;
  let complete = false;
  const seen = new Set();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL("/api/custom/public/assignments/search%20by%20location", baseUrl);
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(pageSize));
    url.searchParams.set("sort", "id,desc");
    url.searchParams.set("query", "");
    url.searchParams.set("radiusInKm", "25");
    url.searchParams.set("location", "");

    const response = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        "x-tenant-id": "dtb"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      throw new Error(`De Transparante Broker gaf HTTP ${response.status} voor pagina ${page}.`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.content)) {
      throw new Error("De Transparante Broker gaf een ongeldig opdrachtenantwoord.");
    }

    if (expectedTotal === null && Number.isInteger(payload.totalElements)) {
      expectedTotal = payload.totalElements;
    }
    if (expectedTotal !== null && Number.isInteger(payload.totalElements) && payload.totalElements !== expectedTotal) {
      throw new Error("Bron veranderde tijdens synchronisatie; probeer opnieuw.");
    }
    for (const raw of payload.content) {
      const assignment = normalizeTransparanteBrokerAssignment(raw);
      if (seen.has(assignment.id)) throw new Error("Dubbel ID tijdens paginatie; volledigheid is niet aantoonbaar.");
      seen.add(assignment.id);
      assignments.push(assignment);
    }

    if (
      payload.last === true ||
      payload.content.length < pageSize ||
      (expectedTotal !== null && assignments.length >= expectedTotal)
    ) {
      complete = true;
      break;
    }
  }

  if (!complete || (expectedTotal !== null && assignments.length !== expectedTotal)) {
    throw new Error(`Onvolledige synchronisatie: ${assignments.length} van ${expectedTotal} opdrachten ontvangen.`);
  }

  return assignments;
}

export function normalizeTransparanteBrokerAssignment(raw) {
  if (!Number.isInteger(raw?.id) && !String(raw?.id || "").trim()) {
    throw new Error("Opdracht zonder bruikbaar extern ID ontvangen.");
  }

  const externalId = String(raw.id);
  return {
    id: `de-transparante-broker:${externalId}`,
    source: "de-transparante-broker",
    externalId,
    sourceUrl: new URL(
      `/opdracht-details/${slug(raw.title)}/${slug(raw.client?.name || raw.employer)}/${externalId}`,
      "https://www.detransparantebroker.nl"
    ).href,
    title: text(raw.title),
    employer: text(raw.employer),
    client: text(raw.client?.name),
    location: text(raw.location),
    hoursMin: finiteNumberOrNull(raw.hoursMin),
    hoursMax: finiteNumberOrNull(raw.hoursMax),
    hourlyRateMin: finiteNumberOrNull(raw.minHourlyRate),
    hourlyRateMax: finiteNumberOrNull(raw.maxHourlyRate),
    startDate: isoOrNull(raw.startDate),
    endDate: isoOrNull(raw.endDate),
    applyDate: isoOrNull(raw.applyDate),
    publishedAt: isoOrNull(raw.storageDate),
    freelancerAllowed: ["YES", "NO"].includes(raw.freelancerAllowed) ? raw.freelancerAllowed : "UNKNOWN",
    assignmentOrigin: text(raw.assignmentOrigin),
    functionTitle: text(raw.jobFunctionGroup?.functionTitle),
    descriptionHtml: typeof raw.beautifiedDescription === "string" ? raw.beautifiedDescription : "",
    active: true
  };
}

export function mergeAssignments(existing, incoming, syncedAt) {
  const incomingById = new Map(incoming.map((assignment) => [assignment.id, assignment]));
  const existingById = new Map(existing.map(assignment => [assignment.id, assignment]));
  const merged = existing
    .filter((assignment) => assignment?.source !== "de-transparante-broker" || !incomingById.has(assignment.id))
    .map((assignment) =>
      assignment?.source === "de-transparante-broker"
        ? { ...assignment, active: false, lastSeenAt: assignment.lastSeenAt || syncedAt, updatedAt: syncedAt }
        : assignment
    );

  for (const assignment of incomingById.values()) {
    const previous = existingById.get(assignment.id);
    merged.push({
      ...previous,
      ...assignment,
      firstSeenAt: previous?.firstSeenAt || syncedAt,
      lastSeenAt: syncedAt,
      updatedAt: syncedAt
    });
  }

  return merged;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function isoOrNull(value) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(value).toISOString();
}

function slug(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "opdracht";
}
