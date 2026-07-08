import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { requireEnv, resolveMailgunConfig } from "../src/config/env.mjs";
import { createEmailService } from "../src/application/email/email-service.mjs";
import { createMailgunClient } from "../src/infrastructure/mailgun/mailgun-client.mjs";

loadLocalEnvFile();

const config = resolveMailgunConfig();
const to = requireEnv(process.env, "MAILGUN_TEST_TO");

if (!config.defaultFrom) {
  throw new Error("MAILGUN_FROM is required for the send-test script");
}

const mailgunClient = createMailgunClient(config);
const emailService = createEmailService({ mailProvider: mailgunClient });

const result = await emailService.sendTransactionalEmail({
  from: config.defaultFrom,
  to,
  subject: "MarcsMusic Mailgun test",
  text: "Mailgun API integration is configured for MarcsMusic.",
  html: "<p>Mailgun API integration is configured for MarcsMusic.</p>",
  tags: ["smoke-test"],
  correlationId: `mailgun-smoke-${Date.now()}`
});

console.log(JSON.stringify(result, null, 2));

function loadLocalEnvFile() {
  const envPath = resolve(process.cwd(), ".env");

  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}
