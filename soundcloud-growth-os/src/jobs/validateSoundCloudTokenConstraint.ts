import { prisma } from "../lib/db/prisma";

async function main() {
  if (process.env.SOUNDCLOUD_TOKEN_VALIDATE_CONSTRAINT !== "true") {
    throw new Error("SOUNDCLOUD_TOKEN_VALIDATE_CONSTRAINT must be exactly true for the validation job.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SET LOCAL lock_timeout = '5s'`;
    await transaction.$executeRaw`SET LOCAL statement_timeout = '30s'`;
    await transaction.$executeRaw`ALTER TABLE "SoundCloudToken" VALIDATE CONSTRAINT "SoundCloudToken_encrypted_envelope_check"`;
  });

  console.log(JSON.stringify({ constraint: "SoundCloudToken_encrypted_envelope_check", validated: true }));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "SoundCloud token constraint validation failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
