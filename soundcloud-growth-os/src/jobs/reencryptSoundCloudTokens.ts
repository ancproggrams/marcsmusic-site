import { prisma } from "../lib/db/prisma";
import { assertSoundCloudTokenEncryptionConfigured } from "../lib/security/tokenEncryption";
import { reencryptSoundCloudTokenRow } from "../lib/soundcloud/tokenStore";

function boundedMaxRows(value: string | undefined) {
  if (value === undefined || value === "") return 100;
  if (!/^[1-9][0-9]{0,3}$/u.test(value)) throw new Error("SOUNDCLOUD_TOKEN_REENCRYPT_MAX_ROWS must be an integer from 1 to 1000.");

  const parsed = Number(value);
  if (parsed > 1_000) throw new Error("SOUNDCLOUD_TOKEN_REENCRYPT_MAX_ROWS must be an integer from 1 to 1000.");
  return parsed;
}

function boundedAfterId(value: string | undefined) {
  if (value === undefined || value === "") return undefined;
  if (value.length > 128 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("SOUNDCLOUD_TOKEN_REENCRYPT_AFTER_ID is invalid.");
  }
  return value;
}

async function main() {
  assertSoundCloudTokenEncryptionConfigured();
  const maxRows = boundedMaxRows(process.env.SOUNDCLOUD_TOKEN_REENCRYPT_MAX_ROWS);
  const afterId = boundedAfterId(process.env.SOUNDCLOUD_TOKEN_REENCRYPT_AFTER_ID);
  const apply = process.env.SOUNDCLOUD_TOKEN_REENCRYPT_APPLY === "true";
  const rows = await prisma.soundCloudToken.findMany({
    where: afterId ? { id: { gt: afterId } } : undefined,
    orderBy: { id: "asc" },
    take: maxRows + 1
  });

  const summary = {
    mode: apply ? "apply" : "dry-run",
    scanned: Math.min(rows.length, maxRows),
    needsReencryption: 0,
    updated: 0,
    conflicts: 0,
    truncated: rows.length > maxRows,
    nextAfterId: rows.length > maxRows ? rows[maxRows - 1]?.id ?? null : null
  };

  for (const row of rows.slice(0, maxRows)) {
    const result = await reencryptSoundCloudTokenRow(prisma, row, { apply });
    if (result.needsReencryption) summary.needsReencryption += 1;
    if (result.updated) summary.updated += 1;
    if (result.conflicted) summary.conflicts += 1;
  }

  console.log(JSON.stringify(summary));
  if (summary.conflicts > 0 || summary.truncated) process.exitCode = 2;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "SoundCloud token re-encryption failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
