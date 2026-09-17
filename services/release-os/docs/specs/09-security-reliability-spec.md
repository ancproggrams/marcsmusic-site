# Security and Reliability Spec

- No secrets in frontend responses.
- No raw provider responses with sensitive data.
- No stack traces to clients.
- Guard real publish, player sync and campaign send.
- Validate MIME type, extension and size for uploads.
- Generate server-side IDs and checksums.
- Use idempotency keys for platform and campaign recipients.
- Bound campaign sends; do not create unbounded queues.
- Store audit events for uploads, syncs, publication attempts and campaigns.

