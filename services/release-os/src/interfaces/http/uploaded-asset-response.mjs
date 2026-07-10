import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const ASSET_TYPES = Object.freeze({
  audio: Object.freeze({
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav"
  }),
  artwork: Object.freeze({
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
  })
});
const HIDDEN_FILESYSTEM_ERRORS = new Set([
  "EACCES",
  "ELOOP",
  "ENAMETOOLONG",
  "ENOENT",
  "ENOTDIR",
  "EPERM"
]);
const SAFE_READ_FLAGS =
  constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0);

export async function sendUploadedAsset(response, uploadRoot, kind, pathname) {
  const prefix = kind === "audio" ? "/assets/audio/" : "/assets/artwork/";
  const filename = decodeAssetFilename(pathname.slice(prefix.length));
  const extension = extname(filename).toLowerCase();
  const mimeType = ASSET_TYPES[kind]?.[extension];

  if (filename.includes("\0") || filename !== basename(filename) || !mimeType) {
    throw assetNotFound();
  }

  const filePath = await resolveUploadedAssetPath(uploadRoot, kind, filename, extension);
  const fileHandle = await openAsset(filePath);

  try {
    let stats;
    try {
      stats = await fileHandle.stat();
    } catch (error) {
      throw assetUnavailable(error);
    }

    if (!stats.isFile()) {
      throw assetNotFound();
    }

    if (response.destroyed) {
      return;
    }

    response.writeHead(200, {
      "content-type": mimeType,
      "content-length": stats.size,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    });
    await pipeline(fileHandle.createReadStream({ autoClose: false }), response);
  } finally {
    await fileHandle.close();
  }
}

function decodeAssetFilename(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw assetNotFound();
  }
}

async function resolveUploadedAssetPath(uploadRoot, kind, filename, extension) {
  try {
    const canonicalRoot = await realpath(resolve(uploadRoot));
    const canonicalSubdir = await realpath(resolve(canonicalRoot, kind));

    if (!isContained(canonicalRoot, canonicalSubdir)) {
      throw assetNotFound();
    }

    const requestedPath = resolve(canonicalSubdir, filename);
    if (!isContained(canonicalSubdir, requestedPath)) {
      throw assetNotFound();
    }

    const canonicalFile = await realpath(requestedPath);
    if (!isContained(canonicalSubdir, canonicalFile) || extname(canonicalFile).toLowerCase() !== extension) {
      throw assetNotFound();
    }

    return canonicalFile;
  } catch (error) {
    if (error.code === "ASSET_NOT_FOUND") {
      throw error;
    }

    if (HIDDEN_FILESYSTEM_ERRORS.has(error.code)) {
      throw assetNotFound();
    }

    throw assetUnavailable(error);
  }
}

async function openAsset(filePath) {
  try {
    return await open(filePath, SAFE_READ_FLAGS);
  } catch (error) {
    if (HIDDEN_FILESYSTEM_ERRORS.has(error.code)) {
      throw assetNotFound();
    }

    throw assetUnavailable(error);
  }
}

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot !== "" &&
    !isAbsolute(pathFromRoot) &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`)
  );
}

function assetNotFound() {
  return Object.assign(new Error("Asset not found"), {
    statusCode: 404,
    code: "ASSET_NOT_FOUND"
  });
}

function assetUnavailable(cause) {
  return Object.assign(new Error("Asset temporarily unavailable", { cause }), {
    statusCode: 503,
    code: "ASSET_UNAVAILABLE"
  });
}
