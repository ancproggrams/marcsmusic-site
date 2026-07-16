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
- `noreply@marcsmusic.nl` is de vaste afzender. Een flow mag alleen een
  functionele `Reply-To` toevoegen.

## Railway-variabelen

Zet secrets uitsluitend via Railway Variables. Nooit in Git, Docker build
arguments, shell history, logs of fixtures.

Applicatieservices (`marcsmusic-release-os` en `outreach-worker-production`):

```text
EMAIL_PROVIDER=plunk
PLUNK_BASE_URL=https://plunk-api-production.up.railway.app
PLUNK_SECRET_KEY=<Railway secret>
EMAIL_FROM=MarcsMusic <noreply@marcsmusic.nl>
PLUNK_FROM=MarcsMusic <noreply@marcsmusic.nl>
PLUNK_WEBHOOK_SECRET=<Railway secret>
PLUNK_SEND_ENABLED=false
OUTREACH_SEND_ENABLED=false
OUTREACH_KILL_SWITCH=true
```

De Plunk-service gebruikt voor de geteste fork:

```text
SMTP_HOST=tuesday.mxrouting.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<MXROUTE_USERNAME>
SMTP_PASSWORD=<Railway secret>
SMTP_FROM_ADDRESS=noreply@marcsmusic.nl
SMTP_FROM_NAME=MarcsMusic
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
8. Schakel pas daarna de Plunk-gate in. Outreach blijft geblokkeerd zolang
   EspoCRM-schema/API en alle observability-gates niet groen zijn.

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
  geconfigureerde SMTP-user. De zichtbare afzender blijft
  `noreply@marcsmusic.nl`; roteer de SMTP-secret uitsluitend via Railway.
- Het productie-EspoCRM weigert momenteel te starten wegens een
  ontbrekend herstel-/rehearsal-attest voor een bestaande database. De
  schema-contractfix staat op `main`, maar mag de migratie-evidence niet
  omzeilen; matching en outreach blijven daarom geblokkeerd.
- Benodigd om dit af te ronden: een echte EspoCRM-volume/config-backup of
  Railway-volume snapshot. Zonder die backup mag de bestaande database niet
  veilig worden gereconstrueerd.
- De gecontroleerde test naar `marc@marcrene.com` is door Plunk geaccepteerd en
  door de worker als `SENT` opgeslagen met een SMTP Message-ID. Laat de
  ontvanger de inbox en authenticatieheaders (SPF/DKIM/DMARC) bevestigen; die
  mailboxcontrole is niet door Railway uitgevoerd.
- `plunk-worker` moet worden uitgerold met `deploy/plunk/railway-worker.json`;
  de API-configuratie `deploy/plunk/railway.json` bevat bewust `/health` en is
  niet geschikt voor de queue-worker.
