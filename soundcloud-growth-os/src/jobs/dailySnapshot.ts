import { prisma } from "../lib/db/prisma";
import { createDailySnapshotForLatestToken } from "../lib/growth/soundcloudSync";

async function main() {
  const result = await createDailySnapshotForLatestToken(prisma);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
