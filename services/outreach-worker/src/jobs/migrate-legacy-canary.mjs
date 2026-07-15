import { lstat, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  assertLegacyCanaryGate,
  LEGACY_CANARY_MAX_CONTACTS
} from "../application/legacy-lead-migration.mjs";

const allowedArguments = new Set([
  "--apply",
  "--report",
  "--expected-source-digest",
  "--expected-report-digest"
]);
assertKnownArguments(process.argv.slice(2));

const apply = process.argv.includes("--apply");
const reportPath = requiredArgument("--report");
const expectedSourceDigest = requiredArgument("--expected-source-digest");
const expectedReportDigest = requiredArgument("--expected-report-digest");
const absoluteReportPath = resolve(reportPath);
const reportStat = await lstat(absoluteReportPath);
if (!reportStat.isFile() || reportStat.isSymbolicLink()) throw new Error("Canary report must be a regular, non-symlink file");
if ((reportStat.mode & 0o077) !== 0) throw new Error("Canary report permissions must be 0600 or stricter");
const report = JSON.parse(await readFile(absoluteReportPath, "utf8"));

assertLegacyCanaryGate({
  report,
  expectedSourceDigest,
  expectedReportDigest,
  environmentName: process.env.RAILWAY_ENVIRONMENT_NAME,
  killSwitch: process.env.OUTREACH_KILL_SWITCH,
  sendEnabled: process.env.OUTREACH_SEND_ENABLED,
  limit: LEGACY_CANARY_MAX_CONTACTS
});

if (!apply) {
  process.stdout.write(`${JSON.stringify({
    status: "validated_only",
    environment: process.env.RAILWAY_ENVIRONMENT_NAME,
    migrationVersion: report.migrationVersion,
    sourceDigest: report.sourceDigest,
    reportDigest: report.reportDigest,
    contactLimit: LEGACY_CANARY_MAX_CONTACTS,
    sendsEnabled: false
  }, null, 2)}\n`);
} else {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL("./migrate-legacy-leads.mjs", import.meta.url)),
    "--apply",
    "--report", absoluteReportPath,
    "--limit", String(LEGACY_CANARY_MAX_CONTACTS),
    "--batch-size", String(LEGACY_CANARY_MAX_CONTACTS)
  ], { env: process.env, stdio: "inherit" });
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Legacy canary terminated by ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
}

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

function assertKnownArguments(argumentsList) {
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!allowedArguments.has(argument)) throw new Error(`Unsupported canary argument: ${argument}`);
    if (argument !== "--apply") index += 1;
  }
}
