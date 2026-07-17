#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const AGENT_BROWSER_VERSION = "0.31.2";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const DEFAULT_OUTPUT = path.join(DATA_DIR, "portal-browser-tests");

const args = parseArgs(process.argv.slice(2));
const outputDir = path.resolve(args.output ?? DEFAULT_OUTPUT);
const screenshotsDir = path.join(outputDir, "screenshots");
const shardIndex = Number(args["shard-index"] ?? 0);
const shardCount = Number(args["shard-count"] ?? 1);
const limit = Number(args.limit ?? 0);
const delayMs = Number(args.delay ?? 1500);
const timeoutMs = Number(args.timeout ?? 30000);
const takeScreenshots = args.screenshots !== "false";

if (!Number.isInteger(shardIndex) || !Number.isInteger(shardCount) || shardCount < 1 || shardIndex < 0 || shardIndex >= shardCount) {
  throw new Error("Invalid --shard-index/--shard-count combination");
}

await mkdir(outputDir, { recursive: true });
if (takeScreenshots) await mkdir(screenshotsDir, { recursive: true });

const allCandidates = await discoverPortalCandidates();
const sharded = allCandidates.filter((candidate) => stableShard(candidate.url, shardCount) === shardIndex);
const candidates = limit > 0 ? sharded.slice(0, limit) : sharded;

const results = [];
for (const [index, candidate] of candidates.entries()) {
  process.stdout.write(`[${index + 1}/${candidates.length}] ${candidate.name} — ${candidate.url}\n`);
  const result = await inspectPortal(candidate).catch((error) => ({
    ...candidate,
    testedAt: new Date().toISOString(),
    status: "error",
    needsManualReview: true,
    error: error instanceof Error ? error.message : String(error),
  }));
  results.push(result);
  await persist(results, allCandidates.length);
  if (delayMs > 0 && index + 1 < candidates.length) await sleep(delayMs);
}

await persist(results, allCandidates.length);
process.stdout.write(`Portal inspection complete: ${results.length} tested, ${allCandidates.length} unique HTTP(S) portal candidates found.\n`);

async function discoverPortalCandidates() {
  const files = (await readdir(DATA_DIR))
    .filter((name) => /^run\d+-platform-database\.json$/.test(name))
    .sort((a, b) => runNumber(a) - runNumber(b));

  const candidates = new Map();
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
    } catch {
      continue;
    }

    for (const platform of collectPlatforms(parsed)) {
      const urls = collectPortalUrls(platform);
      for (const url of urls) {
        const normalized = normalizeUrl(url);
        if (!normalized || candidates.has(normalized)) continue;
        candidates.set(normalized, {
          name: platform.name ?? platform.platformName ?? platform.title ?? normalized,
          url: normalized,
          sourceFile: file,
          priorStatus: platform.status ?? platform.queueStatus ?? null,
          priorLoginRequired: booleanOrNull(platform.loginRequired ?? platform.authorizedRoute?.loginRequired),
          priorCaptchaDetected: booleanOrNull(platform.captchaDetected ?? platform.authorizedRoute?.captchaDetected),
          priorPaymentRequired: booleanOrNull(platform.paymentRequired ?? platform.feeRequired),
        });
      }
    }
  }
  return [...candidates.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function collectPlatforms(value) {
  const found = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (looksLikePlatform(node)) found.push(node);
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return found;
}

function looksLikePlatform(node) {
  return Boolean(
    node.name ||
      node.platformName ||
      node.websiteUrl ||
      node.submissionUrl ||
      node.authorizedRoute?.formLocation ||
      node.submission_form_url,
  );
}

function collectPortalUrls(platform) {
  const raw = [
    platform.submissionUrl,
    platform.submission_url,
    platform.submissionFormUrl,
    platform.submission_form_url,
    platform.formUrl,
    platform.authorizedRoute?.formLocation,
    platform.authorizedRoute?.portalUrl,
    platform.route?.url,
  ];
  return raw.filter((value) => typeof value === "string" && /^https?:\/\//i.test(value));
}

async function inspectPortal(candidate) {
  const domain = new URL(candidate.url).hostname;
  const session = `portal-${createHash("sha256").update(candidate.url).digest("hex").slice(0, 16)}`;
  const common = [
    "--session",
    session,
    "--content-boundaries",
    "--max-output",
    "50000",
    "--allowed-domains",
    `${domain},*.${domain}`,
  ];

  const open = await runAgentBrowser([...common, "open", candidate.url, "--json"], timeoutMs);
  const wait = await runAgentBrowser([...common, "wait", "--load", "domcontentloaded", "--json"], timeoutMs).catch((error) => ({ error: error.message }));
  const title = await runAgentBrowser([...common, "get", "title", "--json"], timeoutMs).catch(() => null);
  const finalUrl = await runAgentBrowser([...common, "get", "url", "--json"], timeoutMs).catch(() => null);
  const snapshot = await runAgentBrowser([...common, "snapshot", "-i", "--urls", "--json"], timeoutMs);
  const consoleMessages = await runAgentBrowser([...common, "console", "--json"], timeoutMs).catch(() => null);
  const pageErrors = await runAgentBrowser([...common, "errors", "--json"], timeoutMs).catch(() => null);

  const text = JSON.stringify(snapshot).toLowerCase();
  const detected = classifySnapshot(text);
  const screenshotPath = takeScreenshots
    ? path.join(screenshotsDir, `${safeName(candidate.name)}-${createHash("sha1").update(candidate.url).digest("hex").slice(0, 8)}.png`)
    : null;

  if (screenshotPath) {
    await runAgentBrowser([...common, "screenshot", screenshotPath, "--full", "--json"], timeoutMs).catch(() => null);
  }
  await runAgentBrowser([...common, "close", "--json"], timeoutMs).catch(() => null);

  return {
    ...candidate,
    testedAt: new Date().toISOString(),
    status: open?.success === false ? "unreachable" : "inspected",
    finalUrl: extractValue(finalUrl),
    title: extractValue(title),
    needsManualReview: true,
    autoSubmitEligible: false,
    detected,
    priorClassification: {
      loginRequired: candidate.priorLoginRequired,
      captchaDetected: candidate.priorCaptchaDetected,
      paymentRequired: candidate.priorPaymentRequired,
    },
    screenshotPath: screenshotPath ? path.relative(ROOT, screenshotPath) : null,
    wait,
    consoleSummary: summarizeAgentOutput(consoleMessages),
    errorSummary: summarizeAgentOutput(pageErrors),
    safety: {
      formFieldsFilled: false,
      buttonsClicked: false,
      filesUploaded: false,
      formSubmitted: false,
      captchaSolved: false,
      loginAttempted: false,
      paymentAttempted: false,
      cookiesOrConsentAccepted: false,
    },
  };
}

function classifySnapshot(text) {
  const contains = (...patterns) => patterns.some((pattern) => text.includes(pattern));
  return {
    formObserved: contains('role":"textbox', 'role":"combobox', 'role":"checkbox', 'role":"radio', "<form"),
    fileUploadObserved: contains("upload", "choose file", "select file", 'type="file"'),
    submitControlObserved: contains("submit", "send music", "send demo", "upload track"),
    captchaOrHumanCheckObserved: contains("captcha", "recaptcha", "hcaptcha", "turnstile", "human verification", "should be empty", "leave blank"),
    loginObserved: contains("log in", "login", "sign in", "create account", "continue with spotify", "oauth"),
    paymentObserved: contains("payment", "checkout", "buy credits", "subscription", "pricing", "pay now", "credit card"),
    consentOrRightsObserved: contains("i agree", "terms", "consent", "permission", "rights", "broadcast authorization", "license"),
    browserVerificationObserved: contains("verify you are human", "checking your browser", "browser verification", "cloudflare"),
  };
}

async function persist(results, totalDiscovered) {
  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    agentBrowserVersion: AGENT_BROWSER_VERSION,
    mode: "inspect-only",
    shard: { index: shardIndex, count: shardCount },
    totalUniqueHttpPortalsDiscovered: totalDiscovered,
    testedInThisShard: results.length,
    inspected: results.filter((item) => item.status === "inspected").length,
    errors: results.filter((item) => item.status === "error" || item.status === "unreachable").length,
    captchaOrHumanCheckObserved: results.filter((item) => item.detected?.captchaOrHumanCheckObserved).length,
    loginObserved: results.filter((item) => item.detected?.loginObserved).length,
    paymentObserved: results.filter((item) => item.detected?.paymentObserved).length,
    formObserved: results.filter((item) => item.detected?.formObserved).length,
    autoSubmitCandidates: 0,
    safety: "No fields are filled, no buttons are clicked, no files are uploaded, and no submission, login, CAPTCHA, consent, or payment is attempted.",
  };

  await writeFile(path.join(outputDir, `portal-results-shard-${shardIndex}.json`), `${JSON.stringify({ summary, results }, null, 2)}\n`);
  await writeFile(path.join(outputDir, `portal-results-shard-${shardIndex}.csv`), toCsv(results));
  await writeFile(path.join(outputDir, `portal-report-shard-${shardIndex}.md`), toMarkdown(summary, results));
}

function toCsv(results) {
  const headers = ["name", "url", "status", "finalUrl", "formObserved", "captchaObserved", "loginObserved", "paymentObserved", "needsManualReview", "sourceFile", "testedAt"];
  const rows = results.map((item) => [
    item.name,
    item.url,
    item.status,
    item.finalUrl ?? "",
    item.detected?.formObserved ?? false,
    item.detected?.captchaOrHumanCheckObserved ?? false,
    item.detected?.loginObserved ?? false,
    item.detected?.paymentObserved ?? false,
    true,
    item.sourceFile,
    item.testedAt,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function toMarkdown(summary, results) {
  const lines = [
    `# Portal Browser Test — shard ${summary.shard.index + 1}/${summary.shard.count}`,
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    `- Unique HTTP(S) portal candidates discovered: ${summary.totalUniqueHttpPortalsDiscovered}`,
    `- Tested in this shard: ${summary.testedInThisShard}`,
    `- Inspected: ${summary.inspected}`,
    `- Errors/unreachable: ${summary.errors}`,
    `- Forms observed: ${summary.formObserved}`,
    `- CAPTCHA/human checks observed: ${summary.captchaOrHumanCheckObserved}`,
    `- Login boundaries observed: ${summary.loginObserved}`,
    `- Payment boundaries observed: ${summary.paymentObserved}`,
    `- Auto-submit candidates: 0`,
    "",
    "> Inspect-only safety mode: no fields are filled, buttons clicked, files uploaded, forms submitted, logins attempted, CAPTCHAs solved, consents accepted, or payments initiated.",
    "",
    "| Platform | Status | Form | CAPTCHA | Login | Payment | URL |",
    "|---|---:|---:|---:|---:|---:|---|",
  ];
  for (const result of results) {
    lines.push(`| ${md(result.name)} | ${result.status} | ${yesNo(result.detected?.formObserved)} | ${yesNo(result.detected?.captchaOrHumanCheckObserved)} | ${yesNo(result.detected?.loginObserved)} | ${yesNo(result.detected?.paymentObserved)} | ${md(result.url)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function runAgentBrowser(args, timeout) {
  const customBinary = process.env.AGENT_BROWSER_BIN;
  const command = customBinary || "npx";
  const commandArgs = customBinary ? args : ["--yes", `agent-browser@${AGENT_BROWSER_VERSION}`, ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      env: {
        ...process.env,
        AGENT_BROWSER_CONTENT_BOUNDARIES: "1",
        AGENT_BROWSER_MAX_OUTPUT: "50000",
        AGENT_BROWSER_NO_AUTO_DIALOG: "1",
        AGENT_BROWSER_DEFAULT_TIMEOUT: String(Math.min(timeout, 25000)),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout + 5000);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`${command} exited ${code}: ${stderr.trim() || stdout.trim()}`));
      const trimmed = stdout.trim();
      if (!trimmed) return resolve({ success: true });
      try {
        resolve(JSON.parse(trimmed));
      } catch {
        resolve({ success: true, data: trimmed });
      }
    });
  });
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function stableShard(value, count) {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0) % count;
}

function parseArgs(input) {
  const parsed = {};
  for (let i = 0; i < input.length; i += 1) {
    const arg = input[i];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) parsed[key] = inlineValue;
    else if (input[i + 1] && !input[i + 1].startsWith("--")) parsed[key] = input[++i];
    else parsed[key] = "true";
  }
  return parsed;
}

function runNumber(name) {
  return Number(name.match(/run(\d+)/)?.[1] ?? 0);
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function extractValue(output) {
  return output?.data?.value ?? output?.data?.text ?? output?.data ?? null;
}

function summarizeAgentOutput(output) {
  if (!output) return null;
  const serialized = JSON.stringify(output);
  return serialized.length > 2000 ? `${serialized.slice(0, 2000)}…` : serialized;
}

function safeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "portal";
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function md(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
