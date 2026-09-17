import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export async function ensurePrivateDirectory(path) {
  const directory = resolve(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const details = await lstat(directory);
  if (!details.isDirectory() || details.isSymbolicLink()) {
    throw new Error("PRIVATE_RUNTIME_DIRECTORY_INVALID");
  }
  if (typeof process.getuid === "function" && details.uid !== process.getuid()) {
    throw new Error("PRIVATE_RUNTIME_DIRECTORY_OWNER_MISMATCH");
  }
  await chmod(directory, 0o700);
  return directory;
}

export async function writePrivateFileAtomic(path, content) {
  const destination = resolve(path);
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const parentDetails = await lstat(parent);
  if (!parentDetails.isDirectory() || parentDetails.isSymbolicLink()) {
    throw new Error("PRIVATE_OUTPUT_DIRECTORY_INVALID");
  }
  const temporary = join(parent, `.${basename(destination)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.chmod(0o600);
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, destination);
    await chmod(destination, 0o600);
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
  }
}
