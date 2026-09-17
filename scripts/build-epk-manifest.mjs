import { constants as fsConstants, lstat, mkdir, open, realpath, rename, stat, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve, sep } from "node:path";

import { createEpkUrlPolicy, EPK_MANIFEST_MAX_BYTES, validateEpkManifest } from "../src/epk/epk-contract.mjs";

try {
  const options = parseArguments(process.argv.slice(2));
  const input = await readInput(options.input);
  const urlPolicy = createEpkUrlPolicy({
    siteOrigin: process.env.APP_BASE_URL || "https://www.marcsmusic.nl",
    allowedHttpsOrigins: process.env.EPK_ALLOWED_HTTPS_ORIGINS || "",
    sameOriginAssetPrefixes: splitCsv(process.env.EPK_PUBLIC_ASSET_PREFIXES || "/assets/epk/")
  });
  const manifest = validateEpkManifest(input, { urlPolicy, allowExample: options.allowExample });
  if (!options.validateOnly) {
    await atomicWriteManifest({ manifest, output: options.output, manifestRoot: process.env.EPK_MANIFEST_ROOT });
  }
  console.log(JSON.stringify({ ok: true, schemaVersion: manifest.schemaVersion, releases: manifest.releases.length, written: !options.validateOnly }));
} catch (error) {
  const code = typeof error?.code === "string" ? error.code : "EPK_BUILD_FAILED";
  const path = typeof error?.path === "string" ? error.path : undefined;
  console.error(JSON.stringify({ ok: false, code, ...(path ? { path } : {}) }));
  process.exitCode = 1;
}

async function readInput(inputPath) {
  const resolved = resolve(inputPath);
  const metadata = await lstat(resolved).catch(() => { throw buildError("EPK_INPUT_UNAVAILABLE"); });
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw buildError("EPK_INPUT_FILE_UNSAFE");
  if (metadata.size < 2 || metadata.size > EPK_MANIFEST_MAX_BYTES) throw buildError("EPK_MANIFEST_SIZE_INVALID");
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const handle = await open(resolved, fsConstants.O_RDONLY | noFollow).catch(() => {
    throw buildError("EPK_INPUT_OPEN_FAILED");
  });
  let raw;
  try {
    const openedMetadata = await handle.stat();
    if (
      !openedMetadata.isFile() || openedMetadata.dev !== metadata.dev || openedMetadata.ino !== metadata.ino ||
      openedMetadata.size < 2 || openedMetadata.size > EPK_MANIFEST_MAX_BYTES
    ) {
      throw buildError("EPK_INPUT_FILE_UNSAFE");
    }
    raw = await handle.readFile({ encoding: "utf8" });
    const afterReadMetadata = await handle.stat();
    if (
      openedMetadata.dev !== afterReadMetadata.dev || openedMetadata.ino !== afterReadMetadata.ino ||
      openedMetadata.size !== afterReadMetadata.size || openedMetadata.mtimeMs !== afterReadMetadata.mtimeMs ||
      Buffer.byteLength(raw) !== openedMetadata.size
    ) {
      throw buildError("EPK_INPUT_CHANGED_DURING_READ");
    }
  } finally {
    await handle.close().catch(() => {});
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw buildError("EPK_MANIFEST_JSON_INVALID");
  }
}

async function atomicWriteManifest({ manifest, output, manifestRoot }) {
  if (!manifestRoot) throw buildError("EPK_MANIFEST_ROOT_REQUIRED");
  const resolvedRoot = resolve(manifestRoot);
  const resolvedOutput = resolve(output);
  if (!isWithin(resolvedRoot, resolvedOutput) || !resolvedOutput.endsWith(".json")) {
    throw buildError("EPK_MANIFEST_PATH_FORBIDDEN");
  }
  await mkdir(resolvedRoot, { recursive: true, mode: 0o700 });
  const rootRealPath = await realpath(resolvedRoot);
  await mkdir(dirname(resolvedOutput), { recursive: true, mode: 0o700 });
  const parentRealPath = await realpath(dirname(resolvedOutput));
  if (!isWithin(rootRealPath, parentRealPath)) throw buildError("EPK_MANIFEST_PATH_FORBIDDEN");
  const destinationPath = resolve(parentRealPath, basename(resolvedOutput));
  if (!isWithin(rootRealPath, destinationPath)) throw buildError("EPK_MANIFEST_PATH_FORBIDDEN");
  const existing = await lstat(destinationPath).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    throw buildError("EPK_MANIFEST_STAT_FAILED");
  });
  if (existing?.isSymbolicLink() || (existing && !existing.isFile())) throw buildError("EPK_MANIFEST_FILE_UNSAFE");

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > EPK_MANIFEST_MAX_BYTES) throw buildError("EPK_MANIFEST_SIZE_INVALID");
  const temporaryPath = resolve(parentRealPath, `.${basename(resolvedOutput)}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporaryPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, destinationPath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  const written = await stat(destinationPath);
  if (!written.isFile() || written.size !== Buffer.byteLength(serialized)) throw buildError("EPK_MANIFEST_WRITE_INCOMPLETE");
  const directoryHandle = await open(parentRealPath, fsConstants.O_RDONLY).catch(() => undefined);
  if (directoryHandle) {
    await directoryHandle.sync().catch(() => {});
    await directoryHandle.close().catch(() => {});
  }
}

function parseArguments(args) {
  const options = { allowExample: false, validateOnly: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--allow-example") options.allowExample = true;
    else if (argument === "--validate-only") options.validateOnly = true;
    else if (argument === "--input" || argument === "--output") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw buildError("EPK_BUILD_ARGUMENT_INVALID");
      options[argument.slice(2)] = value;
      index += 1;
    } else throw buildError("EPK_BUILD_ARGUMENT_INVALID");
  }
  if (!options.input || (!options.validateOnly && !options.output)) throw buildError("EPK_BUILD_ARGUMENT_INVALID");
  return Object.freeze(options);
}

function splitCsv(value) {
  return String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
}

function isWithin(parent, child) {
  return child === parent || child.startsWith(`${parent}${sep}`);
}

function buildError(code) {
  return Object.assign(new Error(code), { code });
}
