# Plunk transactionele e-mail

Voor de volledige Railway-, DNS-, rollout- en rotatieprocedure: zie het
[Plunk/MXRoute productie-runbook](../../../docs/plunk-mxroute-runbook.md).

Release OS gebruikt Plunk als de enige applicatieprovider voor transactionele
e-mail. De provider wordt aangeroepen via `POST /v1/send` met een server-side
Bearer secret. De vaste afzender is `MarcsMusic <noreply@marcsmusic.nl>`.

## Configuratie

Zet deze waarden uitsluitend in Railway variables (secrets blijven secrets):

- `EMAIL_PROVIDER=plunk`
- `PLUNK_BASE_URL=https://mail.marcsmusic.nl` (of de gecontroleerde Plunk API-origin)
- `PLUNK_SECRET_KEY` (Railway secret)
- `PLUNK_SEND_ENABLED=false` totdat de gecontroleerde productiegate is goedgekeurd
- `EMAIL_FROM=MarcsMusic <noreply@marcsmusic.nl>`
- `EMAIL_FROM_NAME=MarcsMusic`
- `EMAIL_TIMEOUT_SECONDS=15`
- `EMAIL_MAX_ATTEMPTS=2`

De client weigert productie-HTTP, een afzenderoverride, ontbrekende secrets en
onveilige headers. Een timeout of netwerkfout wordt als `reconcile_required`
behandeld; de client retryt een onzekere provideruitkomst niet blind.

## Delivery-topologie

```text
MarcsMusic app / outreach-worker
        -> Plunk API
        -> Plunk delivery worker
        -> MXRoute SMTP (tuesday.mxrouting.net:587, STARTTLS)
        -> ontvanger
```

De upstream Plunk v0.12.0-release gebruikt voor delivery standaard AWS SES en
documenteert `SMTP_DOMAIN` alleen voor de inkomende Plunk SMTP-relay. Daarom
mag de Railway-service niet als productie-groen worden gemarkeerd totdat de
gepinde MXRoute-transportfork is uitgerold en getest. AWS SES-credentials
mogen niet worden toegevoegd.

## Smoke test

Zet tijdelijk `PLUNK_SEND_ENABLED=true` alleen voor een beheerd testaccount en
voer uit:

```bash
EMAIL_TEST_TO=beheer@example.com npm run plunk:send-test
```

De output mag uitsluitend provider-id/status bevatten. Zet de gate daarna weer
uit totdat echte inboxdelivery en SPF/DKIM/DMARC-resultaten zijn gecontroleerd.

## Rollback

Zet `PLUNK_SEND_ENABLED=false` en `OUTREACH_SEND_ENABLED=false`, laat lopende
`reconcile_required`-items eerst door een operator beoordelen en wijzig geen
oude provider-identiteit in bestaande outbox-items. Legacy Mailgun-code blijft
alleen als inbound/reconciliation-compatibiliteit bestaan totdat Plunk inbound
events aantoonbaar dezelfde idempotente contracten levert.
