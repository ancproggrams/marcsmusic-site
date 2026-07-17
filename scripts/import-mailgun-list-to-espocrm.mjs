#!/usr/bin/env node

import { createHash } from "node:crypto";
import { boundedFetch, boundedInteger, parseBoundedJson } from "../src/booking/bounded-http.mjs";

const MAX_PAGES = 50;
const MAX_MEMBERS = 5_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const APPLY_CONFIRMATION = "mailgun-quarantine-2026-07-17";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const listAddress = valueAfter("--list-address") || process.env.MAILGUN_LIST_ADDRESS || "";
const outletId = valueAfter("--outlet-id") || "";

const mailgunBaseUrl = validateMailgunBaseUrl(process.env.MAILGUN_BASE_URL || "");
const mailgunApiKey = requireSecret("MAILGUN_API_KEY");
const crmBaseUrl = validateCrmBaseUrl(process.env.ESPOCRM_BASE_URL || "");
const crmApiKey = requireSecret("ESPOCRM_API_KEY");
const crmTimeoutMs = boundedInteger(process.env.CRM_HTTP_TIMEOUT_MS, 10_000, {
  min: 100,
  max: 60_000,
  name: "CRM_HTTP_TIMEOUT_MS"
});

if (!listAddress || !/^\S+@\S+$/.test(listAddress)) {
  throw new Error("MAILGUN_LIST_ADDRESS or --list-address is required.");
}

if (!/^[a-zA-Z0-9]{10,32}$/.test(outletId)) {
  throw new Error("--outlet-id must be an EspoCRM record id.");
}

if (apply && !args.has("--confirm=" + APPLY_CONFIRMATION)) {
  throw new Error(`Apply requires --confirm=${APPLY_CONFIRMATION}.`);
}

const list = await findMailgunList(listAddress);
const members = await readMailgunMembers(list);
const records = canonicalMembers(members);
const sourceDigest = sha256(JSON.stringify(records));

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    listMembers: members.length,
    canonicalContacts: records.length,
    subscribed: records.filter((record) => record.subscribed).length,
    denied: records.filter((record) => !record.subscribed).length,
    sourceDigest,
    quarantine: true,
    sendEnabled: false
  }));
  process.exit(0);
}

const existing = await readExistingContacts();
let created = 0;
let skipped = 0;

for (const record of records) {
  const payload = contactPayload(record);
  const current = existing.get(record.fingerprint);

  if (current) {
    // Existing rows are immutable import evidence. A rerun only fills the
    // missing source rows; it never silently changes a contact's later CRM
    // review decision or consent state.
    skipped += 1;
  } else {
    await crmRequest("POST", "MediaContact", payload);
    created += 1;
  }
}

console.log(JSON.stringify({
  mode: "apply",
  listMembers: members.length,
  canonicalContacts: records.length,
  created,
  skipped,
  sourceDigest,
  quarantine: true,
  sendEnabled: false
}));

async function findMailgunList(address) {
  const response = await mailgunRequest("/v3/lists/pages?limit=100");
  const list = (response.items || []).find((item) => item.address === address);

  if (!list || !Number.isInteger(Number(list.members_count))) {
    throw new Error("MAILGUN_LIST_NOT_FOUND_OR_COUNT_INVALID");
  }

  if (Number(list.members_count) > MAX_MEMBERS) {
    throw new Error("MAILGUN_LIST_TOO_LARGE");
  }

  return list;
}

async function readMailgunMembers(list) {
  const members = [];
  const seenUrls = new Set();
  let nextUrl = `${mailgunBaseUrl}/v3/lists/${encodeURIComponent(list.address)}/members/pages?limit=100`;

  for (let page = 0; page < MAX_PAGES && nextUrl; page += 1) {
    const parsed = new URL(nextUrl);
    if (parsed.protocol !== "https:" || parsed.origin !== mailgunBaseUrl) {
      throw new Error("MAILGUN_PAGING_URL_INVALID");
    }
    if (seenUrls.has(parsed.href)) {
      throw new Error("MAILGUN_PAGING_CYCLE");
    }
    seenUrls.add(parsed.href);

    const response = await mailgunRequest(parsed.pathname + parsed.search);
    const items = Array.isArray(response.items) ? response.items : [];
    if (items.length === 0) break;

    for (const item of items) {
      if (members.length >= MAX_MEMBERS) throw new Error("MAILGUN_MEMBER_LIMIT_EXCEEDED");
      members.push(item);
    }

    const candidate = response.paging?.next;
    nextUrl = typeof candidate === "string" && candidate.length > 0 ? candidate : "";
  }

  const expected = Number(list.members_count);
  if (members.length !== expected) {
    throw new Error("MAILGUN_MEMBER_COUNT_RECONCILIATION_FAILED");
  }

  return members;
}

function canonicalMembers(members) {
  const byFingerprint = new Map();

  for (const member of members) {
    const email = normalizeEmail(member?.address);
    if (!email) continue;

    const fingerprint = sha256(`email:${email}`);
    const record = {
      email,
      name: cleanText(member?.name, 180) || "Unknown",
      subscribed: member?.subscribed === true,
      fingerprint
    };

    const previous = byFingerprint.get(fingerprint);
    if (!previous || (record.subscribed && !previous.subscribed)) {
      byFingerprint.set(fingerprint, record);
    }
  }

  return [...byFingerprint.values()].sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
}

function contactPayload(record) {
  const { firstName, lastName } = splitName(record.name);
  const denied = !record.subscribed;

  return {
    name: record.name,
    firstName,
    lastName,
    emailAddress: record.email,
    mediaOutletId: outletId,
    fingerprint: record.fingerprint,
    contactBasis: "Unknown",
    contactPurpose: "Unknown",
    contactEvidence: "Historical Mailgun list membership; not consent evidence.",
    contactSourceUrl: "https://mg.marcsmusic.nl",
    emailValidationStatus: "Unknown",
    smtpValidationStatus: "Unknown",
    status: "Needs Validation",
    doNotContact: true,
    optedOut: denied,
    emailAddressIsOptedOut: denied,
    hardBounced: false,
    previousPositiveReply: false,
    futureReleaseInterest: "Unknown"
  };
}

async function readExistingContacts() {
  const existing = new Map();
  for (let offset = 0; offset <= MAX_MEMBERS; offset += 200) {
    const query = new URLSearchParams({
      maxSize: "200",
      offset: String(offset),
      select: "id,fingerprint"
    });
    const response = await crmRequest("GET", `MediaContact?${query}`);
    for (const row of response.list || []) {
      if (row?.id && row?.fingerprint) existing.set(row.fingerprint, row);
    }
    if (!response.list || response.list.length < 200) break;
  }
  return existing;
}

async function mailgunRequest(path) {
  const response = await boundedFetch(new URL(path, `${mailgunBaseUrl}/`), {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString("base64")}`,
      Accept: "application/json"
    }
  }, { timeoutMs: crmTimeoutMs, maxResponseBytes: MAX_RESPONSE_BYTES });

  if (!response.ok) {
    throw new Error("MAILGUN_READ_FAILED");
  }
  return parseBoundedJson(response, "MAILGUN_RESPONSE_INVALID_JSON");
}

async function crmRequest(method, path, body = null) {
  const response = await boundedFetch(new URL(`api/v1/${path.replace(/^\/+/, "")}`, `${crmBaseUrl}/`), {
    method,
    headers: {
      "X-Api-Key": crmApiKey,
      "Content-Type": "application/json",
      "X-Skip-Duplicate-Check": "true"
    },
    body: body ? JSON.stringify(body) : null
  }, { timeoutMs: crmTimeoutMs, maxResponseBytes: MAX_RESPONSE_BYTES });

  if (!response.ok) throw new Error("CRM_IMPORT_REQUEST_REJECTED");
  return parseBoundedJson(response, "CRM_IMPORT_RESPONSE_INVALID_JSON");
}

function validateMailgunBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.hostname !== "api.eu.mailgun.net" || !["", "/"].includes(parsed.pathname)) {
    throw new Error("MAILGUN_BASE_URL must be https://api.eu.mailgun.net.");
  }
  return parsed.origin;
}

function validateCrmBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("ESPOCRM_BASE_URL must be a credential-free HTTPS URL.");
  }
  return parsed.origin;
}

function requireSecret(name) {
  const value = process.env[name] || "";
  if (!value || /[\r\n]/u.test(value)) throw new Error(`${name} is required.`);
  return value;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ? email : "";
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function splitName(value) {
  const name = cleanText(value, 180) || "Unknown";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return { firstName: "", lastName: parts[0] || "Unknown" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) };
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
