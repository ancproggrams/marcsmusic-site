# Legacy Mailgun compatibility boundary

This document describes the retained Mailgun client only for historical
inbound/outcome-reconciliation fixtures. It is not an outbound production
sender. New transactionele e-mail uses [Plunk](plunk.md) and the MXRoute
transport.

MarcsMusic sends email through Mailgun's REST API using a small internal client in `src/infrastructure/mailgun`.

## Configuration

Copy `.env.example` to `.env` and fill in:

- `MAILGUN_API_KEY`: private API key or a domain sending key.
- `MAILGUN_DOMAIN`: verified sending domain, for example `mg.example.com`.
- `MAILGUN_REGION`: `us` or `eu`.
- `MAILGUN_FROM`: default sender address.
- `MAILGUN_TEST_TO`: recipient for the smoke-test script.
- `MAILGUN_TIMEOUT_MS`: deadline for headers and complete response-body read.
- `MAILGUN_MAX_RESPONSE_BYTES`: hard response-body cap (default 65,536 bytes).
- `LEGACY_OUTREACH_SEND_ENABLED`: must be exactly `true` in an isolated
  non-production runtime. Production/Railway markers always deny before
  provider I/O, even when this flag is set.

Use a domain sending key for production sending when possible. It limits the key to Mailgun's message send endpoints for one domain.

## Local Smoke Test

```bash
LEGACY_OUTREACH_SEND_ENABLED=true npm run mailgun:send-test
```

Run this only with isolated non-production credentials and an approved test recipient. The script loads `.env` when present, sends one transactional smoke-test email, and prints only Mailgun's message ID and queue message. It does not print API keys or request headers.

## Runtime Boundary

This client is a deprecated integration boundary retained for isolated tests. Production outreach must use `services/outreach-worker`; it is the only path that enforces EspoCRM authority, suppressions, durable idempotency, capacity controls and delivery-uncertainty handling. `MailgunClient` also enforces the legacy gate as defense in depth.

```js
import { resolveMailgunConfig } from "../src/config/env.mjs";
import { isLegacyOutreachSendEnabled } from "../src/domain/legacy-outreach-send-policy.mjs";
import { createEmailService } from "../src/application/email/email-service.mjs";
import { createMailgunClient } from "../src/infrastructure/mailgun/mailgun-client.mjs";

const mailgunClient = createMailgunClient({
  ...resolveMailgunConfig(),
  legacyOutreachSendEnabled: isLegacyOutreachSendEnabled(process.env)
});
const emailService = createEmailService({ mailProvider: mailgunClient });

await emailService.sendTransactionalEmail({
  to: "fan@example.com",
  subject: "New set posted",
  text: "A new MarcsMusic set is live.",
  html: "<p>A new MarcsMusic set is live.</p>",
  correlationId: "request-or-job-id"
});
```

## Operational Notes

- Configure the correct region. US domains use `https://api.mailgun.net`; EU domains use `https://api.eu.mailgun.net`.
- Treat `429` and `5xx` responses as retryable. The client retries retryable statuses and network timeouts with bounded backoff.
- Treat `400`, `401`, and `403` as non-retryable configuration or request failures.
- Always provide a correlation ID from the caller so logs and Mailgun events can be reconciled later.
- Do not log `MAILGUN_API_KEY`, Authorization headers, or full outbound payloads containing recipient data.
