# Plunk/MXRoute deployment gate

This directory pins the Plunk source that was inspected for the MarcsMusic
deployment. `UPSTREAM_REF` is the immutable Git commit used for the review:

```text
8f23d8aac479ae4e7d9926965f090c75afd3f6d5
```

The reference is **not** a production-ready MXRoute build. It is kept here so
that a future maintained fork can be built reproducibly and so that a Railway
deployment cannot silently move to an unreviewed upstream tag.

## Blocking compatibility finding

At this commit Plunk's outbound path is hard-wired to AWS SES:

- `apps/api/src/services/SESService.ts` imports `@aws-sdk/client-ses` and calls
  `sendRawEmail` on an SES client;
- `apps/api/src/app/constants.ts` requires `AWS_SES_REGION`,
  `AWS_SES_ACCESS_KEY_ID` and `AWS_SES_SECRET_ACCESS_KEY` at process startup;
- the API email worker imports the SES service to discover an SES account quota;
- domain verification, DKIM token generation and feedback forwarding all call
  SES APIs;
- `apps/smtp` is an **inbound** SMTP server that forwards received messages to
  Plunk's `/v1/send` endpoint. It does not deliver Plunk messages through an
  external SMTP relay.

Consequently, setting `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD` or `SMTP_SECURE` in Railway would be ignored by outbound Plunk
delivery. Adding those variables to a Dockerfile or Railway service without a
reviewed source patch would create a false production-success signal and would
still require AWS credentials. This violates the MarcsMusic no-SES and
fail-closed requirements.

`apply-mxroute-patch.sh` therefore refuses to modify or build this source. It
checks the pinned ref and source fingerprints, then exits with a stable error
until a reviewed fork patch is supplied. The refusal is intentional; do not
replace it with a variable-only workaround.

## Required fork scope before deployment

A production fork must make all of the following changes in one reviewed
commit (with tests and a clean dependency lockfile):

1. Replace `SESService.sendRawEmail` with a bounded SMTP client using
   `SMTP_HOST=tuesday.mxrouting.net`, `SMTP_PORT=587`, STARTTLS,
   `SMTP_USER` and `SMTP_PASSWORD` from Railway secrets. TLS certificate
   verification must remain enabled; no plaintext fallback is allowed.
2. Remove the required AWS SES imports and startup variables. The final image
   must not contain a live SES sender or silently fall back to SES.
3. Define the sender policy centrally and allow only
   `noreply@marcsmusic.nl` for this instance. Reject arbitrary project sender
   domains unless their DNS and authorization flow is implemented and tested.
4. Replace SES DKIM/domain-verification and quota calls with an explicit
   MXRoute/DNS contract. Do not mark a domain verified merely because SMTP
   authentication succeeded.
5. Preserve idempotency and classify an SMTP timeout/disconnect after `DATA`
   as an uncertain delivery. Such a message must be quarantined for
   reconciliation, not retried blindly by the default BullMQ attempts.
6. Add unit, integration and negative tests for STARTTLS, certificate
   validation, auth failure, provider rejection, timeout-after-DATA and
   duplicate/idempotency behavior. Keep all credentials out of fixtures/logs.

Only after that fork is built and the image metadata records this exact
`UPSTREAM_REF` plus patch commit should a Railway Plunk service be created.

## Known MXRoute values (non-secret)

| Setting | Value |
| --- | --- |
| SMTP host | `tuesday.mxrouting.net` |
| SMTP port | `587` |
| Encryption | STARTTLS (explicit TLS) |
| Authentication | required |
| From address | `noreply@marcsmusic.nl` |

The MXRoute username and password are deliberately not committed. The
password must be entered only as a Railway secret (or retrieved from approved
secret custody) and must never be printed by a build or deployment command.

## Railway rollout order after the fork exists

Keep application and Plunk send gates disabled. Deploy the Plunk image and
database migrations first, prove health and SMTP handshake with a controlled
test account, then configure the application `PLUNK_BASE_URL` and secret.
Inspect Plunk's pending/failed/uncertain queue before enabling any dispatcher;
old pending records must not be sent unexpectedly. Roll back by disabling the
Plunk send gate and the application send gate, then reconcile uncertain
messages before changing provider identity.
