#!/usr/bin/env node

import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { boundedFetch, boundedInteger, parseBoundedJson } from "../src/booking/bounded-http.mjs";

const DEFAULT_CSV_PATH = "data/film-director-leads-2026-07-06.csv";
const MAX_CSV_BYTES = 10 * 1024 * 1024;
const MAX_CSV_ROWS = 10_000;
const REQUIRED_CSV_HEADERS = [
  "name", "type_genre", "location", "recent_project", "website", "public_contact",
  "social", "interest_reason", "opening_line", "lead_temperature"
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const csvPath = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || DEFAULT_CSV_PATH;

const baseUrl = validateCrmBaseUrl(process.env.ESPOCRM_BASE_URL || "", { required: !dryRun });
const apiKey = process.env.ESPOCRM_API_KEY || "";
const entityName = process.env.ESPOCRM_IMPORT_ENTITY || "Contact";
const crmTimeoutMs = boundedInteger(process.env.CRM_HTTP_TIMEOUT_MS, 5_000, {
  min: 100,
  max: 60_000,
  name: "CRM_HTTP_TIMEOUT_MS"
});

if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(entityName)) {
  throw new Error("ESPOCRM_IMPORT_ENTITY is invalid.");
}

if (!baseUrl || !apiKey) {
  if (!dryRun) {
    console.error("ESPOCRM_BASE_URL and ESPOCRM_API_KEY are required. Use --dry-run to validate the CSV without importing.");
    process.exit(1);
  }
}

const resolvedCsvPath = resolve(csvPath);
const csvDetails = await lstat(resolvedCsvPath);
if (!csvDetails.isFile() || csvDetails.isSymbolicLink() || csvDetails.size > MAX_CSV_BYTES) {
  throw new Error("CSV_INPUT_INVALID");
}
const csv = await readFile(resolvedCsvPath, "utf8");
const rows = parseCsv(csv);

if (rows.length === 0 || rows.length > MAX_CSV_ROWS) {
  console.error("CSV must contain between 1 and 10,000 lead records.");
  process.exit(1);
}

let created = 0;
let updated = 0;

for (const row of rows) {
  const payload = buildContactPayload(row);

  if (dryRun) {
    continue;
  }

  const existing = await findExistingContact(payload.firstName, payload.lastName);

  if (existing?.id) {
    await crmRequest("PUT", `${entityName}/${encodeURIComponent(existing.id)}`, payload);
    updated += 1;
  } else {
    await crmRequest("POST", entityName, payload);
    created += 1;
  }
}

console.log(
  dryRun
    ? `Validated ${rows.length} film director lead records without emitting personal data.`
    : `Imported ${rows.length} film director leads into EspoCRM ${entityName}: ${created} created, ${updated} updated.`
);

function buildContactPayload(row) {
  const { firstName, lastName } = splitName(row.name);
  const description = [
    "Lead source: public film director outreach research",
    "Outreach category: Composer / sound designer / music producer collaboration",
    `Type / genre: ${row.type_genre}`,
    `Location: ${row.location}`,
    `Recent project: ${row.recent_project}`,
    `Website / portfolio: ${row.website}`,
    `Public contact route: ${row.public_contact}`,
    `Social media: ${row.social}`,
    `Why interesting: ${row.interest_reason}`,
    `Personal opening line: ${row.opening_line}`,
    `Lead warmth: ${row.lead_temperature}`,
    "Data policy: public information only; no private or leaked contact data."
  ].join("\n");

  return {
    firstName,
    lastName,
    description
  };
}

async function findExistingContact(firstName, lastName) {
  const filters = [
    {
      attribute: "lastName",
      value: lastName
    }
  ];

  if (firstName) {
    filters.push({
      attribute: "firstName",
      value: firstName
    });
  }

  const query = new URLSearchParams({ maxSize: "1" });

  filters.forEach((filter, index) => {
    query.set(`where[${index}][type]`, "equals");
    query.set(`where[${index}][attribute]`, filter.attribute);
    query.set(`where[${index}][value]`, filter.value);
  });

  const result = await crmRequest("GET", `${entityName}?${query.toString()}`);
  return result.list?.[0] || null;
}

async function crmRequest(method, path, body = null) {
  const response = await boundedFetch(new URL(`api/v1/${path.replace(/^\/+/, "")}`, `${baseUrl}/`), {
    method,
    headers: {
      "X-Api-Key": apiKey,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : null
  }, {
    timeoutMs: crmTimeoutMs,
    maxResponseBytes: 512 * 1024
  });

  if (!response.ok) {
    throw Object.assign(new Error("CRM_IMPORT_REQUEST_REJECTED"), {
      code: "CRM_IMPORT_REQUEST_REJECTED",
      retryable: response.status === 429 || response.status >= 500
    });
  }
  return parseBoundedJson(response, "CRM_IMPORT_RESPONSE_INVALID_JSON");
}

function splitName(fullName) {
  const cleaned = cleanText(fullName, 120);

  if (cleaned.includes("&")) {
    return { firstName: "", lastName: cleaned };
  }

  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length <= 1) {
    return { firstName: "", lastName: parts[0] || "Unknown" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1)
  };
}

function parseCsv(input) {
  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      record.push(field);
      if (record.some((value) => value.length > 0)) {
        records.push(record);
      }
      field = "";
      record = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  if (inQuotes) {
    throw new Error("CSV_QUOTING_INVALID");
  }

  const [headers, ...rows] = records;
  if (
    !Array.isArray(headers) ||
    new Set(headers).size !== headers.length ||
    REQUIRED_CSV_HEADERS.some((header) => !headers.includes(header))
  ) {
    throw new Error("CSV_HEADERS_INVALID");
  }

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, cleanText(row[index] || "", 5000)]))
  );
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
}

function validateCrmBaseUrl(value, { required }) {
  if (!value && !required) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ESPOCRM_BASE_URL is invalid.");
  }
  const allowedProtocols = process.env.NODE_ENV === "test" ? new Set(["https:", "http:"]) : new Set(["https:"]);
  if (!allowedProtocols.has(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("ESPOCRM_BASE_URL must be a credential-free HTTPS URL.");
  }
  return stripTrailingSlash(url.toString());
}
