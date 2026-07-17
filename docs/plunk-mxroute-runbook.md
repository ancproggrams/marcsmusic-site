# Plunk/MXRoute productie-runbook

Dit runbook beschrijft de gecontroleerde uitrol van transactionele e-mail voor
MarcsMusic. De Railway-deployment bouwt de gepinde Plunk-bron met de
reviewde native MXRoute-patch. De applicatieprovider is Plunk; MXRoute blijft
de SMTP-relay. De bulk-send-gates blijven dicht totdat alle CRM-, matching- en
observability-gates groen zijn. Een gecontroleerde Plunk/MXRoute-test is
eenmalig uitgevoerd; de ontvanger moet inboxplaatsing nog bevestigen.

## Eigenaarschap en topologie

```text
marcsmusic-release-os / outreach-worker
        -> Plunk API (Bearer secret)
        -> Plunk email worker
        -> MXRoute tuesday.mxrouting.net:587 (STARTTLS + AUTH)
        -> ontvanger
```

- EspoCRM blijft de bron voor contact- en suppressiebeslissingen.
- `outreach-worker` bezit de duurzame send-lease, deduplicatie en safety
  circuit; de Plunk-ID wordt als provideridentiteit opgeslagen.
- Alleen de Plunk-service voert Plunk database-migraties uit. De applicatie-
  en outreach-services voeren geen concurrerende Plunk-migraties uit.
- `noreply@marcsmusic.nl` blijft de standaardafzender voor transactionele
  mail. Outreach gebruikt expliciet `marc@marcsmusic.nl`; beide adressen
  moeten in de Plunk sender-allowlist staan.

## Railway-variabelen

Zet secrets uitsluitend via Railway Variables. Nooit in Git, Docker build
arguments, shell history, logs of fixtures.

Gedeelde applicatievariabelen:

```text
EMAIL_PROVIDER=plunk
PLUNK_BASE_URL=https://plunk-api-production.up.railway.app
PLUNK_SECRET_KEY=<Railway secret>
PLUNK_WEBHOOK_SECRET=<Railway secret>
```

`marcsmusic-release-os` (transactionele mail):

```text
EMAIL_FROM=MarcsMusic <noreply@marcsmusic.nl>
PLUNK_FROM=MarcsMusic <noreply@marcsmusic.nl>
PLUNK_SEND_ENABLED=true
```

`outreach-worker-production` (outreach, standaard fail-closed):

```text
PLUNK_FROM=MarcsMusic <marc@marcsmusic.nl>
OUTREACH_SEND_ENABLED=true
OUTREACH_KILL_SWITCH=false
```

Actuele productie-status: `PLUNK_SEND_ENABLED=true` op
`marcsmusic-release-os` en de technische outreach-verzendcapability is actief
(`OUTREACH_SEND_ENABLED=true`, `OUTREACH_KILL_SWITCH=false`). De nieuw
geïmporteerde historische contacten blijven echter door CRM-beleid
`doNotContact=true` en worden pas eligible na expliciete validatie en
operator-goedkeuring.

De Plunk-service gebruikt voor de geteste fork:

```text
SMTP_HOST=tuesday.mxrouting.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<MXROUTE_USERNAME>
SMTP_PASSWORD=<Railway secret>
SMTP_FROM_ADDRESS=noreply@marcsmusic.nl
SMTP_FROM_NAME=MarcsMusic
SMTP_ALLOWED_FROM_ADDRESSES=noreply@marcsmusic.nl,marc@marcsmusic.nl
```

`SMTP_PASSWORD` en de Plunk API/webhook secrets worden afzonderlijk geroteerd;
een secret wordt nooit hergebruikt tussen deze functies.

## Cloudflare/DNS-controle

Voer eerst een read-only inventaris uit en archiveer de resultaten met
timestamp en operatorreferentie. Wijzig geen MX-record zonder vastgesteld
incident.

- Behoud de bestaande MXRoute-MX-records.
- Mailrecords zijn `DNS only`; nooit proxied.
- Er bestaat precies één SPF-TXT-record op `marcsmusic.nl`. Voeg geen tweede
  `v=spf1` toe. Autoriseer alleen de partij die daadwerkelijk namens het
  From-domein verzendt (MXRoute).
- Gebruik de DKIM-selector en CNAME/TXT-waarden van MXRoute, niet van SES of
  een Plunk-hosted relay. Conflicterende selectors eerst oplossen.
- Behoud of verbeter DMARC gecontroleerd; begin bij bewezen nieuwe delivery
  met `p=none` en een geldig rapportageadres. Verhoog pas na rapportage naar
  `quarantine` of `reject`.
- `mail.marcsmusic.nl` is al een MXRoute CNAME en mag niet naar Plunk worden
  omgezet. Gebruik voor een custom Plunk-origin een nieuw, niet-conflicterend
  subdomein; de Railway-origin blijft geldig zolang DNS niet is gewijzigd.
- Plunk-domeinverificatierecords zijn alleen nodig wanneer de gekozen fork die
  expliciet implementeert. Voeg geen fictieve verificatierecords toe.

Controleer na elke wijziging met publieke DNS-lookups en leg alleen
recordnamen en niet-gevoelige waarden vast.

Read-only baseline, gecontroleerd via publieke resolvers op 16 juli 2026:

- `marcsmusic.nl` MX: `10 tuesday.mxrouting.net`, `20 tuesday-relay.mxrouting.net`.
- `marcsmusic.nl` SPF: één record, `v=spf1 include:mxroute.com -all`.
- `x._domainkey.marcsmusic.nl`: MXRoute-DKIM-record aanwezig; de sleutel wordt
  hier bewust niet herhaald.
- `_dmarc.marcsmusic.nl`: strict alignment (`adkim=s`, `aspf=s`) met
  `p=reject` en Cloudflare-rapportageadres.
- `mail.marcsmusic.nl` CNAME: `tuesday.mxrouting.net` (DNS-only gedrag).

Deze records autoriseren MXRoute al voor beide From-adressen binnen
`marcsmusic.nl`; er is daarom geen DNS-mutatie nodig. Een extra SPF-record of
fictieve Plunk/SES-DKIM-record zou de productieconfiguratie juist breken.

## Uitrolvolgorde

1. Haal `origin/main` opnieuw op en maak een schone checkout/worktree.
2. Bouw de gepinde Plunk-fork; controleer Dockerfile, upstream commit en
   patchdigest in de deploymentmetadata.
3. Deploy de Plunk-service met beide application-send gates uit. Controleer migrations,
   `/health`, Redis/Postgres-connectiviteit en SMTP STARTTLS zonder `DATA`.
4. Controleer dat pending, failed en onzekere Plunk-mails bekend zijn. Oude
   pending records worden niet automatisch vrijgegeven.
5. Configureer dezelfde Plunk-origin, afzender en secret op beide
   applicatieservices. Herstart/deploy broncode; verander niet alleen Railway
   variables en neem aan dat een oude image vervangen is.
6. Configureer de Plunk lifecycle-workflows naar
   `POST /webhooks/plunk` met een constant `eventType`, stabiele
   `event.emailId` en de gedeelde webhook-secret.
7. Stuur één beheerde test naar een expliciet goedgekeurd testaccount. Bewijs
   Plunk-acceptatie, de MXRoute SMTP-250 na `DATA`, inbox, SPF, DKIM, DMARC en
   één provider-ID zonder duplicaat. `SENT` in Plunk bewijst relay-acceptatie;
   het is geen zelfstandig bewijs van inboxplaatsing.
8. Schakel pas daarna de Plunk-gate in. Houd daarnaast CRM-eligibility en
   operator-goedkeuring los van de technische verzendcapability; een actief
   transport mag geen quarantainecontacten verzenden.

## Rollback en rotatie

Bij providerfouten: zet eerst `PLUNK_SEND_ENABLED=false`,
`OUTREACH_SEND_ENABLED=false` en `OUTREACH_KILL_SWITCH=true`. Parkeer
onzekere resultaten voor reconciliatie; stuur ze niet opnieuw op basis van een
timeout alleen. Herstel eerst de oorzaak en controleer queue-ouderdom voordat
een gate opnieuw wordt geopend.

Voor secretrotatie: maak een nieuw Plunk API- of webhook-secret, plaats het
als Railway secret, deploy beide consumers, controleer health en webhook
authenticatie, en verwijder daarna het oude secret. Roteer
`SMTP_PASSWORD` afzonderlijk bij MXRoute en voer alleen een geauthenticeerde
handshake uit; log de credential nooit.

## Resterende productie-gates

- Het Plunk-project en domeinrecord zijn eenmalig transactioneel gebootstrapt
  in de dedicated Plunk-database; de secret staat uitsluitend als Railway
  secret op de consumers. Een dashboard-owneraccount ontbreekt nog en moet
  met een expliciet aangewezen beheerder worden gekoppeld voordat dashboard-
  beheer wordt gebruikt.
- De MXRoute-authenticatie is gevalideerd met de Railway-secret en de
  geconfigureerde SMTP-user. De zichtbare afzender voor transactionele mail
  blijft `noreply@marcsmusic.nl`; outreach gebruikt `marc@marcsmusic.nl`.
  Roteer de SMTP-secret uitsluitend via Railway.
- EspoCRM is op 17 juli 2026 als nieuwe productie-installatie uitgerold met
  een lege, geïsoleerde database `espocrm_fresh_20260717` en een nieuwe
  Railway-volume `marcsmusic-crm-fresh-volume`. De oude database en het oude
  volume zijn niet gewist en blijven buiten de actieve route.
- Op 16 juli 2026 zijn twee vergrendelde Railway-safety-copies aangemaakt:
  `crm-pre-recovery-2026-07-16` voor `/var/www/persistent` en
  `mysql-pre-recovery-2026-07-16` voor de MySQL-volume. Dit zijn afzonderlijke
  COW-preservation points; er is geen restore uitgevoerd en ze vormen nog geen
  bewezen consistency point.
- De dedicated API-gebruiker `marcsmusic-outreach-api` gebruikt een beperkte
  rol voor de CRM- en outreach-entiteiten. De API-key staat uitsluitend als
  Railway-secret op `outreach-worker-production`, `marcsmusic-release-os` en
  `marcsmusic-site`; de tijdelijke admin-sessietokens zijn na de bootstrap
  ingetrokken.
- De Mailgun-lijst `radio-stations@mg.marcsmusic.nl` is read-only gepagineerd
  gevalideerd tegen 1.651 leden. Alle 1.651 records zijn rechtstreeks in
  EspoCRM als `MediaContact` geïmporteerd met `status=Needs Validation` en
  `doNotContact=true`; 1.649 behouden `optedOut=false` en 2 behouden
  `optedOut=true`. Mailgun-lidmaatschap is niet als wettelijke toestemming
  geïnterpreteerd. De import is idempotent en logt geen adressen, namen of
  `vars`.
- De actieve CRM-, matching- en Plunk-verzendcapabilities zijn groen. De
  technische verzendgate is actief, maar alle geïmporteerde contacten blijven
  `doNotContact=true`/`Needs Validation`; zonder expliciete validatie en
  operator-goedkeuring ontstaat geen outreach-eligibility. De send-queue was
  leeg bij het openen van de gate.
- De gecontroleerde outreach-test naar `marc@marcrene.com` is door Plunk
  geaccepteerd en als `SENT` opgeslagen vanuit `marc@marcsmusic.nl` met
  Message-ID `<marcsmusic-outreach-test-20260716-c087a788-fc7b-4715-95fc-b89b9a6ee15a@marcsmusic.nl>`.
  De SMTP-relay gaf `250` voor `MAIL FROM`; dezelfde idempotency-key gaf bij
  herhaling `409`, dus er is geen duplicaat. Inboxplaatsing en
  SPF/DKIM/DMARC-headers moeten nog in de doelmailbox worden bevestigd.
- `plunk-worker` moet worden uitgerold met `deploy/plunk/railway-worker.json`;
  de API-configuratie `deploy/plunk/railway.json` bevat bewust `/health` en is
  niet geschikt voor de queue-worker.
