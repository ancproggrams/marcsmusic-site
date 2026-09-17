import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { requireEnv, resolvePlunkConfig } from "../src/config/env.mjs";
import { createEmailService } from "../src/application/email/email-service.mjs";
import { createPlunkClient } from "../src/infrastructure/plunk/plunk-client.mjs";

loadLocalEnvFile();

const config = resolvePlunkConfig();
const to = requireEnv(process.env, "EMAIL_TEST_TO");

if (!config.sendEnabled) {
  throw new Error("PLUNK_SEND_ENABLED=true is required for the controlled send-test script");
}

const plunkClient = createPlunkClient({ ...config, env: process.env });
const emailService = createEmailService({ emailProvider: plunkClient });

const result = await emailService.sendTransactionalEmail({
  from: config.defaultFrom,
  to,
  subject: "MarcsMusic – Plunk/MXRoute productietest",
  text: "MarcsMusic Plunk/MXRoute delivery test.",
  html: "<p>MarcsMusic Plunk/MXRoute delivery test.</p>",
  tags: ["smoke-test"],
  correlationId: `plunk-smoke-${Date.now()}`
});

console.log(JSON.stringify(result, null, 2));

function loadLocalEnvFile() {
  const envPath = resolve(process.cwd(), ".env");

  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}
