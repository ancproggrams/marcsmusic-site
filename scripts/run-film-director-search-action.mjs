#!/usr/bin/env node

import { spawn } from "node:child_process";
import { open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CSV_PATH = "data/film-director-leads-2026-07-06.csv";
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || process.env.SEARCH_ACTION_DRY_RUN === "true";
const discoveryEnabled =
  !args.has("--no-discovery") && process.env.FILM_DIRECTOR_DISCOVERY_ENABLED !== "false";
const csvPath = process.env.FILM_DIRECTOR_LEADS_CSV || DEFAULT_CSV_PATH;
const searchOutputCsvPath =
  process.env.FILM_DIRECTOR_SEARCH_OUTPUT_CSV ||
  `${tmpdir()}/marcsmusic-film-director-leads-combined.csv`;
const lockPath =
  process.env.SEARCH_ACTION_LOCK_PATH || `${tmpdir()}/marcsmusic-film-director-search.lock`;
const lockTtlMs = parsePositiveInteger(process.env.SEARCH_ACTION_LOCK_TTL_MS, DEFAULT_LOCK_TTL_MS);

let lockHandle = null;
let shouldReleaseLock = false;
const startedAt = Date.now();

try {
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
          csvPath,
          discoveryEnabled,
          dryRun
        },
        null,
        2
      )
    );

    log("info", "Starting film director search action", { csvPath, discoveryEnabled, dryRun });
    const importCsvPath = await prepareImportCsv(csvPath, dryRun);
    await runImport(importCsvPath, dryRun);
    log("info", "Finished film director search action", { elapsedMs: Date.now() - startedAt });
  }
} catch (error) {
  log("error", "Film director search action failed", {
    error: error instanceof Error ? error.stack || error.message : String(error)
  });
  process.exitCode = 1;
} finally {
  if (lockHandle) {
    await lockHandle.close().catch(() => {});
  }

  if (shouldReleaseLock) {
    await rm(lockPath, { force: true }).catch((error) => {
      log("warn", "Could not remove search action lock", {
        lockPath,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }
}

async function acquireLock(path, ttlMs) {
  try {
    return await open(path, "wx");
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }

    if (!(await isStaleLock(path, ttlMs))) {
      log("warn", "Previous film director search action is still active; skipping this run", {
        lockPath: path
      });
      return null;
    }

    await rm(path, { force: true });

    try {
      return await open(path, "wx");
    } catch (retryError) {
      if (retryError?.code === "EEXIST") {
        log("warn", "Another film director search action acquired the lock; skipping this run", {
          lockPath: path
        });
        return null;
      }

      throw retryError;
    }
  }
}

async function isStaleLock(path, ttlMs) {
  try {
    const lockStat = await stat(path);
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
    return path;
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
  return searchOutputCsvPath;
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
