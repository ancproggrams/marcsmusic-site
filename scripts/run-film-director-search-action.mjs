#!/usr/bin/env node

import { spawn } from "node:child_process";
import { lstat, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePrivateDirectory } from "../src/film-leads/private-files.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CSV_PATH = "data/film-director-leads-2026-07-06.csv";
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000;
const DEFAULT_RUNTIME_DIRECTORY = join(tmpdir(), "marcsmusic-film-director");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || process.env.SEARCH_ACTION_DRY_RUN === "true";
const discoveryEnabled =
  !args.has("--no-discovery") && process.env.FILM_DIRECTOR_DISCOVERY_ENABLED !== "false";
const csvPath = process.env.FILM_DIRECTOR_LEADS_CSV || DEFAULT_CSV_PATH;
const searchOutputCsvPath =
  process.env.FILM_DIRECTOR_SEARCH_OUTPUT_CSV ||
  join(DEFAULT_RUNTIME_DIRECTORY, "combined-leads.csv");
const lockPath =
  process.env.SEARCH_ACTION_LOCK_PATH || join(DEFAULT_RUNTIME_DIRECTORY, "search.lock");
const lockTtlMs = parsePositiveInteger(process.env.SEARCH_ACTION_LOCK_TTL_MS, DEFAULT_LOCK_TTL_MS);
const retainDiscoveryOutput = process.env.FILM_DIRECTOR_RETAIN_DISCOVERY_OUTPUT === "true";

let lockHandle = null;
let shouldReleaseLock = false;
let generatedOutputPath = null;
const startedAt = Date.now();

try {
  await ensurePrivateDirectory(DEFAULT_RUNTIME_DIRECTORY);
  if (discoveryEnabled && resolve(searchOutputCsvPath) === resolve(csvPath)) {
    throw new Error("FILM_DIRECTOR_SEARCH_OUTPUT_CSV must not overwrite the seed CSV.");
  }
  lockHandle = await acquireLock(lockPath, lockTtlMs);

  if (!lockHandle) {
    process.exitCode = 0;
  } else {
    shouldReleaseLock = true;
    await lockHandle.writeFile(
      JSON.stringify(
        {
          pid: process.pid,
          startedAt: new Date(startedAt).toISOString(),
          discoveryEnabled,
          dryRun
        },
        null,
        2
      )
    );

    log("info", "Starting film director search action", { discoveryEnabled, dryRun });
    const prepared = await prepareImportCsv(csvPath, dryRun);
    generatedOutputPath = prepared.temporary ? prepared.path : null;
    await runImport(prepared.path, dryRun);
    log("info", "Finished film director search action", { elapsedMs: Date.now() - startedAt });
  }
} catch (error) {
  log("error", "Film director search action failed", {
    reasonCode: actionReasonCode(error)
  });
  process.exitCode = 1;
} finally {
  if (generatedOutputPath && !retainDiscoveryOutput) {
    await rm(generatedOutputPath, { force: true }).catch(() => {});
  }
  if (lockHandle) {
    await lockHandle.close().catch(() => {});
  }

  if (shouldReleaseLock) {
    await rm(lockPath, { force: true }).catch((error) => {
      log("warn", "Could not remove search action lock", {
        reasonCode: actionReasonCode(error)
      });
    });
  }
}

async function acquireLock(path, ttlMs) {
  try {
    const handle = await open(path, "wx", 0o600);
    await handle.chmod(0o600);
    return handle;
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }

    if (!(await isStaleLock(path, ttlMs))) {
      log("warn", "Previous film director search action is still active; skipping this run", {
        reasonCode: "SEARCH_ACTION_ALREADY_RUNNING"
      });
      return null;
    }

    await rm(path, { force: true });

    try {
      const handle = await open(path, "wx", 0o600);
      await handle.chmod(0o600);
      return handle;
    } catch (retryError) {
      if (retryError?.code === "EEXIST") {
        log("warn", "Another film director search action acquired the lock; skipping this run", {
          reasonCode: "SEARCH_ACTION_LOCK_RACE"
        });
        return null;
      }

      throw retryError;
    }
  }
}

async function isStaleLock(path, ttlMs) {
  try {
    const lockStat = await lstat(path);
    if (!lockStat.isFile() || lockStat.isSymbolicLink()) {
      throw new Error("SEARCH_ACTION_LOCK_INVALID");
    }
    if (typeof process.getuid === "function" && lockStat.uid !== process.getuid()) {
      throw new Error("SEARCH_ACTION_LOCK_OWNER_MISMATCH");
    }
    return Date.now() - lockStat.mtimeMs > ttlMs;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return true;
    }

    throw error;
  }
}

async function prepareImportCsv(path, shouldDryRun) {
  if (!discoveryEnabled) {
    return { path, temporary: false };
  }

  const discoveryArgs = [
    "scripts/discover-film-director-leads.mjs",
    "--seed",
    path,
    "--output",
    searchOutputCsvPath
  ];

  if (shouldDryRun) {
    discoveryArgs.push("--dry-run");
  }

  await runNode(discoveryArgs);
  return { path: searchOutputCsvPath, temporary: true };
}

async function runImport(path, shouldDryRun) {
  const importArgs = ["scripts/import-film-director-leads-to-espocrm.mjs", path];

  if (shouldDryRun) {
    importArgs.push("--dry-run");
  }

  await runNode(importArgs);
}

async function runNode(nodeArgs) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, nodeArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          signal
            ? `Film director task terminated by signal ${signal}`
            : `Film director task exited with code ${code}`
        )
      );
    });
  });
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function actionReasonCode(error) {
  const candidate = typeof error?.code === "string" ? error.code : "";
  return /^[A-Z0-9_]{3,80}$/.test(candidate) ? candidate : "SEARCH_ACTION_FAILED";
}

function log(level, message, context = {}) {
  console.log(
    JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...context
    })
  );
}
