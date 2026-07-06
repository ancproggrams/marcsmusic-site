#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_CSV_PATH = "data/film-director-leads-2026-07-06.csv";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const csvPath = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || DEFAULT_CSV_PATH;

const baseUrl = stripTrailingSlash(process.env.ESPOCRM_BASE_URL || "");
const apiKey = process.env.ESPOCRM_API_KEY || "";
const entityName = process.env.ESPOCRM_IMPORT_ENTITY || "Contact";

if (!baseUrl || !apiKey) {
  if (!dryRun) {
    console.error("ESPOCRM_BASE_URL and ESPOCRM_API_KEY are required. Use --dry-run to validate the CSV without importing.");
    process.exit(1);
  }
}

const csv = await readFile(resolve(csvPath), "utf8");
const rows = parseCsv(csv);

if (rows.length === 0) {
  console.error(`No rows found in ${csvPath}`);
  process.exit(1);
}

let created = 0;
let updated = 0;

for (const row of rows) {
  const payload = buildContactPayload(row);

  if (dryRun) {
    const displayName = [payload.firstName, payload.lastName].filter(Boolean).join(" ");
    console.log(`[dry-run] ${displayName}`);
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
    ? `Validated ${rows.length} film director leads from ${csvPath}.`
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
  const query = new URLSearchParams({
    "where[0][type]": "equals",
    "where[0][attribute]": "lastName",
    "where[0][value]": lastName,
    "where[1][type]": "equals",
    "where[1][attribute]": "firstName",
    "where[1][value]": firstName,
    maxSize: "1"
  });

  const result = await crmRequest("GET", `${entityName}?${query.toString()}`);
  return result.list?.[0] || null;
}

async function crmRequest(method, path, body = null) {
  const response = await fetch(`${baseUrl}/api/v1/${path.replace(/^\/+/, "")}`, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : null
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.message || payload.error?.message || `EspoCRM request failed (${response.status})`);
  }

  return payload;
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

  const [headers, ...rows] = records;

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
