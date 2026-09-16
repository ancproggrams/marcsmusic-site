# Engineering audit — MarcsMusic

Datum: 16 september 2026. Scope: huidige working tree van de rootrepository, inclusief de nog niet gecommitte wijzigingen in `server.js`, `lib/` en `test/`. De genegeerde nevenprojecten zoals `MatchA/`, decks en screenshots zijn geen onderdeel van deze audit. Geen productie-endpoints aangeroepen en geen applicatiecode gewijzigd.

Methode: statische inspectie van backend, frontend, importer, tests en deploymentbestanden; uitvoering van `npm test`; gerichte lokale reproducties op de daadwerkelijke functies met gesimuleerde integraties en een lokale HTTP-server. Geen productieconfiguratie, infrastructuurtoegang, penetratietest, loadtest of hersteltest beschikbaar. Dit rapport dekt de gevraagde reviewgebieden, maar geeft geen garantie dat alle fouten gevonden zijn.

## 1. Executive summary

**Niet productierijp voor betrouwbare betaalde boekingen.** Het grootste acute probleem is dat de statische server de volledige projectmap als public directory behandelt. Daarnaast zijn betaling, annulering en agendabevestiging geen bewaakte toestandsovergangen. Daardoor kan een geannuleerde boeking herleven, kan een betaalde boeking zonder agenda-event blijven staan en kan de reservering daarbij verdwijnen.

Alle **9 bestaande tests slagen**. Ze testen voornamelijk succesvolle integraties met lokale stubs; ze onderbouwen geen herstelbaarheid, veilige webhookconcurrentie of correcte verwerking van echte agendaformaten.

De architectuur hoeft geen microservices te worden. Een kleine modulaire monoliet met transactionele opslag en een duurzame synchronisatieworker past beter. De vacature-import deelt nu onnodig opslag en foutimpact met de boekingsdienst.

### Indicatieve scores

Scores zijn reviewer-inschattingen op basis van onderstaande bevindingen, geen gemeten benchmarks of certificering. Voor kwaliteit geldt hoger = beter; voor risico hoger = slechter. Onzekerheidsmarge circa 10 punten.

| Onderdeel | Score / 100 | Onderbouwing |
|---|---:|---|
| Onderhoudbaarheid | 42 | Benoemde functies, maar circa 1.780 regels met alle verantwoordelijkheden in één serverbestand |
| Schaalbaarheid | 18 | Volledige JSON-read/write per mutatie; uitsluitend proceslokale serialisatie |
| Betrouwbaarheid | 25 | Geen duurzaam herstel van gedeeltelijk geslaagde workflows |
| Architectuurvolwassenheid | 35 | Server-side credentials; ontbrekende domeingrenzen en statusinvarianten |
| Operationele volwassenheid | 20 | Liveness bestaat; readiness, alerts en herstelbewijs ontbreken |
| Engineeringkwaliteit | 35 | Werkende basischecks, kritieke negatieve scenario's ontbreken |
| Testvolwassenheid | 32 | Procesintegratietests met isolatie, beperkte foutdekking |
| Vertrouwen in regressiebescherming | 30 | De gereproduceerde fouten passeren de bestaande suite |
| Regressierisico | 75 | Statuslogica verspreid; globale configuratie en side effects |
| Productierisico | 85 | Publieke bestandsblootstelling en inconsistenties na betaling |
| Risico van ongetoetste/speculatieve codepatronen | 60 | Dode herstelhelper, onjuiste idempotentie- en retry-aannames |

AI-auteurschap is niet vast te stellen uit de code. De laatste score beschrijft eigenschappen die ook door mensen geschreven code kan hebben. Een numerieke uitvalkans is zonder incidentdata en belastingmetingen niet verantwoord.

## 2. Detailed findings — top 20 risico's en verbeteringen

P0 = acuut ernstig; P1 = hoge prioriteit; P2 = geplande verbetering. De volgorde is tevens de prioriteitsvolgorde van de twintig verbeteringen.

### F01 — P0 — Volledige projectmap wordt publiek geserveerd

**Locatie:** `server.js:217`, `server.js:1725`.

**Bewijs:** lokale HTTP-requests naar `/server.js` en `/.gitignore` geven 200. De resolver accepteert ook `/data/bookings.json`. Rootbegrenzing voorkomt ontsnappen uit de map, maar beschermt bestanden binnen die map niet.

**Oorzaak:** `root = resolve('.')` is zowel repository-root als public root; elk bestaand bestand wordt gestreamd, met publieke caching.

**Impact:** broncode en meegeleverde interne bestanden zijn downloadbaar. Bij de standaard lokale DB-locatie is ook klantdata bereikbaar; Railway gebruikt standaard `/data/bookings.json` buiten de public root, dus dat specifieke datalek is daar configuratieafhankelijk. Een `.env` of `.git` lekt uitsluitend als die bestanden daadwerkelijk worden meegeleverd. Meer deployartefacten vergroten het risico en de herstelkosten.

**Oplossing/voorbeeld:** serve uitsluitend `public/` met de drie HTML-pagina's en expliciete assets; houd database en deploymentbestanden erbuiten. Test dat `/server.js`, `/.env`, `/.git/config` en `/data/bookings.json` altijd 404 geven. Blokkeer ook symlinkontsnapping. Onderzoek bestaande blootstelling voordat eventuele credentials worden geroteerd.

### F02 — P1 — Een geannuleerde boeking wordt opnieuw bevestigd

**Locatie:** `server.js:1034`, `server.js:1589`.

**Bewijs:** gerichte uitvoering van `confirmPaidBooking` op een record met `status='cancelled'` resulteert bij succesvolle integraties in `confirmed`.

**Oorzaak:** alleen `confirmed` met een event-UID wordt overgeslagen; alle andere statussen worden onvoorwaardelijk `paid_calendar_pending`.

**Impact:** een herhaald betaald-webhookbericht kan een administratieve annulering terugdraaien. Concurrent annuleren en bevestigen geeft hetzelfde risico. Klanten en beheerders krijgen tegenstrijdige afspraken; supportlast groeit met webhookvolume.

**Oplossing/voorbeeld:** expliciete overgangstabel en versiecontrole. Een betaling op een geannuleerde boeking leidt naar `refund_review`, nooit automatisch naar `confirmed`; updates gebruiken `WHERE id=? AND version=? AND status=?`.

### F03 — P1 — Agenda-uitval na betaling wordt als webhooksucces afgehandeld

**Locatie:** `server.js:376`, `server.js:1097`, `server.js:1141`.

**Bewijs:** een gesimuleerde fout bij eventcreatie resulteert in `calendar_failed`; de functie resolveert zonder fout en `getReservedIntervals` retourneert geen blokkade voor die boeking. De HTTP-handler antwoordt vervolgens 200.

**Oorzaak:** fout wordt opgeslagen maar ingeslikt; geen duurzame retrytaak. Ook `manual_review` houdt geen reservering vast.

**Impact:** geld ontvangen zonder bevestigde afspraak, terwijl hetzelfde tijdslot opnieuw verkocht kan worden. Herstel vereist handwerk; afhankelijkheidsstoringen treffen alle gelijktijdige klanten.

**Oplossing/voorbeeld:** schrijf betaling plus een duurzame agendataak atomair weg; laat de betaalde reservering bestaan tot expliciete oplossing. Worker met begrensde retries, backoff en alarm voor uitputting. Zonder duurzame acceptatie een retrybare fout retourneren.

### F04 — P1 — Agenda-eventcreatie is niet herstelbaar bij crash of parallelle webhook

**Locatie:** `server.js:1034`, `server.js:1078`, `server.js:1266`.

**Bewijs uit control flow:** twee handlers kunnen beide voorbij de statuscheck komen. De PUT gebruikt dezelfde UID en `If-None-Match: *`. De tweede PUT kan 412 krijgen en de status alsnog op `calendar_failed` zetten. Na een crash tussen succesvolle PUT en DB-write ziet de volgende beschikbaarheidscheck bovendien het eigen event als conflict.

**Oorzaak:** geen exclusieve claim op bevestigingswerk; geen herkenning van bestaande eigen events en geen herstelpad voor onbekende PUT-uitkomst.

**Impact:** duplicaten in aflevering leiden tot foutstatussen ondanks een bestaand event; meer webhookconcurrentie vergroot de foutkans.

**Oplossing/voorbeeld:** transactionele claim met lease/version; GET op deterministische event-URL om een bestaand event inhoudelijk te verifiëren; eigen UID uitsluiten van conflicten. Test crash na PUT vóór commit en twee parallelle paid-webhooks.

### F05 — P1 — Terugkerende afspraken blokkeren latere voorkomens niet

**Locatie:** `server.js:1185`, `server.js:1257`, `server.js:1364`.

**Bewijs:** een dagelijks herhaald event vanaf 1 september levert voor 20 september nul busy intervals op.

**Oorzaak:** REPORT vraagt geen recurrence-expansie; parser verwerkt alleen DTSTART/DTEND en negeert RRULE, RDATE, EXDATE en uitzonderingen.

**Impact:** structureel dubbele boekingen op herhaalde afspraken, ook bij laag volume. Klanten kunnen betalen voor onbeschikbare tijden.

**Oplossing/voorbeeld:** gebruik CalDAV free-busy of vraag begrensde `calendar-data/expand` op, met een parser die uitzonderingen ondersteunt. Een tijdsfilter alleen expandeert de ontvangen kalenderdata niet automatisch; zie [RFC 4791](https://www.rfc-editor.org/rfc/rfc4791), §7.8.3 en §9.6.5.

### F06 — P1 — TZID en floating time worden als UTC geïnterpreteerd

**Locatie:** `server.js:1364`, `server.js:1385`.

**Bewijs:** `DTSTART;TZID=Europe/Amsterdam:20260920T120000` wordt 12:00Z; correct is 10:00Z.

**Oorzaak:** parameters voor de dubbele punt worden weggegooid; `Z?` accepteert zowel lokale als UTC-tijden en gebruikt altijd `Date.UTC`.

**Impact:** agenda-overlap wordt op verkeerde uren gecontroleerd; zomer-/wintertijd verandert de afwijking. Onderhoud aan de regex lost de ontbrekende kalendermodelsemantiek niet op.

**Oplossing/voorbeeld:** behoud TZID, VTIMEZONE en floating-timecontext in een iCalendar-parser, of gebruik servergegenereerde busy intervallen. Zie [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), §3.3.5. Test Amsterdam in zomer en winter, hele dagen en events met DURATION in plaats van DTEND.

### F07 — P1 — CRM-fout ná betaalcreatie geeft reservering vrij

**Locatie:** `server.js:765`, `server.js:788`, `server.js:796`.

**Trigger:** Mollie-payment is aangemaakt en opgeslagen, maar de laatste CRM-update mislukt.

**Oorzaak:** één brede catch markeert de gehele setup als `setup_failed`, ook wanneer betaalcreatie al gelukt is.

**Impact:** request faalt, betaling blijft bestaan en de lokale reservering verdwijnt uit beschikbaarheid. Een herhaalde poging kan extra records/betalingen maken; support moet systemen vergelijken.

**Oplossing/voorbeeld:** behandel deze CRM-update als duurzaam synchronisatiewerk; retourneer de bestaande checkout. Gebruik een client-idempotencykey en een provider-idempotencykey voor retrybare betaalcreatie, plus reconciliatie na onbekende netwerkuitkomsten.

### F08 — P1 — JSON-opslag verliest correctheid bij meerdere processen

**Locatie:** `server.js:147`, `server.js:174`, `server.js:181`.

**Oorzaak:** `dbQueue` serialiseert alleen één Node-proces. Twee processen lezen dezelfde toestand en overschrijven elkaars volledige bestand. Zonder gedeelde opslag ontstaat in plaats daarvan datasplitsing.

**Impact:** verloren boekingen/betalingen en dubbele reserveringen bij horizontale scaling of overlappende deployments. Iedere mutatie is O(D) lezen, parsen en schrijven voor totale datasetgrootte D; requestqueues hebben geen limiet.

**Oplossing/voorbeeld:** transactionele database met unieke payment-ID's en overlapconstraint op actieve reserveringen. Tot migratie slechts één writer; test restore van backups. Atomic rename helpt binnen één schrijver, maar is geen transactiemechanisme tussen processen.

### F09 — P1 — Annulering meldt succes ondanks mislukte agenda-delete

**Locatie:** `server.js:1589`.

**Oorzaak:** status wordt eerst `cancelled`; DELETE- en CRM-fouten worden alleen gelogd en `{ok:true}` wordt teruggegeven.

**Impact:** admin denkt dat de afspraak verwijderd is terwijl de agenda bezet blijft. Storing veroorzaakt langdurige omzetderving en handmatige opschoning.

**Oplossing/voorbeeld:** `cancel_requested` plus duurzame delete-/CRM-taken; toon synchronisatiestatus. Pas na bevestigde verwerking `cancelled`, of maak domeinannulering en integratiestatus expliciet apart zichtbaar.

### F10 — P1 — Nieuw boekingscontact overschrijft nieuwsbriefconsent

**Locatie:** `server.js:743`, `server.js:1474`, `server.js:1506`.

**Trigger:** een bestaande abonnee boekt met hetzelfde e-mailadres en custom fields staan aan.

**Oorzaak:** boekingsflow stuurt `newsletterOptIn:false` en `consentAt:null`; de generieke upsert schrijft die waarden over het bestaande contact.

**Impact:** bestaande toestemming en CRM-data raken inconsistent met de lokale nieuwsbriefadministratie. Zonder custom fields wordt de description met consentcontext overschreven. Omgekeerd kan nieuwsbriefinschrijving telefoon en naam van een bestaand contact leegmaken.

**Oplossing/voorbeeld:** aparte patches voor contactgegevens en consent. Een boeking stuurt geen consentvelden mee; lege nieuwsbriefvelden verwijderen geen bekende CRM-gegevens. Bewaar consent als afzonderlijke gebeurtenissen.

### F11 — P2 — `pending_retry` heeft geen retrymechanisme

**Locatie:** `server.js:557` en `server.js:579`.

**Bewijs:** repositoryzoekactie vindt de status, maar geen consumer die deze records opnieuw synchroniseert.

**Oorzaak:** administratieve status wordt behandeld alsof er een workflow achter zit.

**Impact:** nieuwsbriefinschrijvingen blijven na tijdelijke CRM-uitval lokaal staan terwijl de tekst automatisch herstel belooft; gemiste inschrijvingen en onzichtbare operationele schuld.

**Oplossing/voorbeeld:** duurzame outbox met volgende poging, pogingenteller, laatste fout en unieke contact/consent-sleutel. Dashboard voor oudste wachtende taak.

### F12 — P1 — Paginacap geldt ten onrechte als volledige import

**Locatie:** `lib/transparante-broker.js:14`, `lib/transparante-broker.js:52`, `server.js:484`.

**Bewijs:** stub zonder `totalElements`, met steeds een volle pagina en `last:false`, retourneert na 100 pagina's toch succes.

**Oorzaak:** einde for-loop wordt niet onderscheiden van bevestigd einde van de bron.

**Impact:** `mergeAssignments` deactiveert alle niet ontvangen opdrachten, ook als die op pagina 101+ staan. Grotere bronnen veroorzaken juist meer foutieve verwijderingen uit actief aanbod.

**Oplossing/voorbeeld:** bewaar een `completed`-vlag die alleen bij een geldig eindsignaal gezet wordt. Bij cap, inconsistente metadata of onvoldoende volledigheidsbewijs geen deactivatie uitvoeren; rapporteer gedeeltelijke sync.

### F13 — P2 — Dubbele bron-ID's worden dubbel opgeslagen

**Locatie:** `lib/transparante-broker.js:41`, `lib/transparante-broker.js:93`.

**Bewijs:** 100 ontvangen rijen met hetzelfde ID leveren 100 records op in de merge. `incomingById` bestaat, maar de insert-loop gebruikt `incoming`.

**Impact:** verschuivende offsetpagina's geven duplicaten en opgeblazen tellingen; ruwe aantallen kunnen bovendien ten onrechte volledigheid suggereren. De `existing.find` binnen de loop kost O(N×M).

**Oplossing/voorbeeld:** valideer unieke IDs en paginavoortgang; merge over `incomingById.values()` en indexeer existing met een Map. Behandel deduplicatie niet als bewijs dat ontbrekende pagina-items ontvangen zijn.

### F14 — P2 — Rate limiter heeft onbeperkte cardinaliteit en vertrouwt headers

**Locatie:** `server.js:284`, `server.js:297`.

**Oorzaak:** buckets worden nooit verwijderd; client-IP komt rechtstreeks uit proxyheaders zonder vastgelegde trust boundary.

**Impact:** geheugen groeit O(aantal ooit geziene IP-sleutels). Bij direct bereikbare origin of niet-overschreven headers kan een client de limiet ontwijken. Bij correcte proxyreiniging blijft het geheugenprobleem bestaan.

**Oplossing/voorbeeld:** begrensde TTL/LRU-opslag en geconfigureerde trusted proxy; bij replicas gedeelde limiter. Apart budget voor admin-authpogingen en webhookverificatieverzoeken.

### F15 — P2 — Geen expliciete integratiedeadlines of begrensde retries

**Locatie:** `server.js:899`, `server.js:946`, `server.js:1163`, `server.js:1434`.

**Oorzaak:** CRM, CalDAV en Mollie-fetches hebben geen applicatiedeadline. De importer heeft wel `AbortSignal.timeout`.

**Impact:** trage dependencies houden requests/resources langdurig bezig en vertragen de hele boekingsketen. Platformdefaults zijn geen afgestemde businessdeadline; blinde retries op mutaties zouden duplicaten toevoegen.

**Oplossing/voorbeeld:** fetch-wrapper met een totale deadline, begrensde responsegrootte, foutclassificatie en concurrencylimiet. Retry uitsluitend idempotente operaties of verzoeken met een betrouwbare idempotencykey.

### F16 — P1 — Ongeldige slotstap kan de event loop oneindig blokkeren

**Locatie:** `server.js:17`, `server.js:84`, `server.js:625`.

**Trigger:** `BOOKING_SLOT_STEP_MINUTES=0` of een negatief getal, gevolgd door availability voor een normale werkdag.

**Oorzaak:** parsing controleert alleen of een integerwaarde bestaat; de for-loop verhoogt de teller met de geconfigureerde stap.

**Impact:** oneindige synchrone loop; healthchecks, boekingen en admin vallen allemaal uit. Een deploymentfout kan een herstartcyclus veroorzaken.

**Oplossing/voorbeeld:** bij startup schema-validatie: `Number.isInteger(step) && step > 0 && step <= 1440`; valideer ook duur, tarieven, werkdag, tijdzone en holdlimieten. Start niet met een onbruikbare configuratie.

### F17 — P2 — Dubbele buffer op lokale reserveringen

**Locatie:** `server.js:628`, `server.js:1119`, `server.js:1141`.

**Oorzaak:** opgeslagen intervallen worden met buffer uitgebreid, en het te toetsen interval nogmaals.

**Impact:** bij een bedoelde minimale tussenruimte van 30 minuten wordt tussen twee lokale boekingen 60 minuten vereist. Een extern event krijgt slechts één buffer; beschikbaarheid hangt dus af van de bron. Capaciteit en omzet nemen af.

**Oplossing/voorbeeld:** leg vast of de instelling tussenruimte of een zone per afspraak is. Bij tussenruimte: bewaar ruwe intervallen en breid uitsluitend de kandidaat uit; test exact 29/30/31 minuten. Bij bewust twee zones: documenteer dat en pas externe events consistent aan.

### F18 — P2 — De healthcheck blijft groen bij onbruikbare opslag/integraties

**Locatie:** `server.js:321`, `railway.json:5`.

**Oorzaak:** `/api/health` rapporteert altijd `ok`; configuratieaanwezigheid wordt gelijkgesteld aan integratiereadiness. Geen opslagcheck of signalering van achterstallige synchronisatie.

**Impact:** deployment kan succesvol lijken met onbeschrijfbare/corrupte DB of defecte boekingsflow. Onopgemerkte storingen duren langer, met omzetverlies en supportdruk.

**Oplossing/voorbeeld:** houd liveness goedkoop, voeg begrensde readiness toe en meet foutpercentages, payment-to-confirm-lag, queue age en DB-writefouten. Niet iedere tijdelijke externe fout aan liveness koppelen: dat kan herstartstormen geven.

### F19 — P1 bij gebruik defaults — Deployment heeft voorspelbare admincredentials

**Locatie:** `deploy/espocrm/docker-compose.yml:7`, `deploy/espocrm/docker-compose.yml:32`.

**Oorzaak:** ontbrekende variabelen vallen terug op `change-admin-password`, `change-db-password` en `change-root-password`.

**Impact:** een nieuw uitgerolde instance kan met bekende waarden draaien; CRM bevat klantgegevens. De bevinding betreft het template, niet bewezen productiegebruik.

**Oplossing/voorbeeld:** `${ESPOCRM_ADMIN_PASSWORD:?required}` en equivalenten voor DB-secrets. Pin daarnaast containerimages en Pythondependencies voor reproduceerbare, toetsbare upgrades; `latest` en `3.*` veranderen buiten de review om.

### F20 — P2 — Availabilityresponses kunnen de verkeerde selectie overschrijven

**Locatie:** `booking.html:1040`.

**Trigger:** gebruiker kiest datum A en snel daarna B; het antwoord voor A arriveert als laatste.

**Oorzaak:** geen AbortController of requestvolgnummer voordat `renderSlots` wordt uitgevoerd.

**Impact:** scherm toont slots van A bij geselecteerde datum B. Server valideert de ingestuurde slotdatum wel, maar niet de datum die de gebruiker visueel dacht te kiezen. Trage netwerken vergroten de kans op vergissingen en supportvragen.

**Oplossing/voorbeeld:** `const sequence = ++latestSequence; ... if (sequence !== latestSequence) return;` en wis slotselectie bij elke verandering. Test bewust omgekeerde responsevolgorde.

## 3. Architecture report

### Sterke punten en grenzen

Credentials blijven in de backend. De betalingstatus wordt bij de provider opgehaald. De code heeft herkenbare functienamen, integerbedragen, begrensde requestbodies en lokale serialisatie van writes. Deze voorzieningen zijn nuttig, maar dwingen de belangrijkste domeininvarianten nog niet af.

### Afhankelijkheden en bounded contexts

```text
Browser -> server.js -> CRM
                    -> Mollie
                    -> CalDAV
                    -> JSON-opslag
                    -> transparante-broker.js -> publieke opdrachtenbron
```

Geen cyclische lokale importketen aangetroffen. Wel sterke verborgen koppeling door globale envconfiguratie, bestandsopslag, module-initialisatie en directe netwerkcalls. Boeking, betaling, agenda, nieuwsbrief en vacature-import delen één server en één document. Vacaturedata en persoonlijke betaal-/contactdata hebben verschillende levenscycli en herstelbehoeften.

### Laaggrenzen en domeinconsistentie

HTTP, domeinlogica, integraties, persistency en cron zitten samen in `server.js`. `createBooking` en `confirmPaidBooking` combineren beleid met lange reeksen side effects. DTO-selectie bestaat bijvoorbeeld in `publicBookingStatus`; intern ontbreekt een eenduidig statusmodel. Er is geen repositorypattern: het toevoegen van generieke interfaces zonder concrete test-/opslaggrens helpt niet.

Aanbevolen modules: booking-domain (transities, interval- en prijsbeleid), application (orchestratie), adapters (CRM/Mollie/CalDAV), persistence en routes. Houd dit één deploybare app; voeg een duurzame worker toe zodra taken atomair opgeslagen kunnen worden. Temporal, microservices en distributed locks zijn niet aanwezig en zijn geen noodzakelijke eerste stap.

### Codekwaliteit en AI-code-risico

`findEventByBookingId` (`server.js:1301`) is ongebruikt en zou altijd niets vinden: de busy-parser gooit `bookingId` weg. Verwijder of herstel deze schijnbare recoveryfunctie. `server.js:1748` verwijst bij ontbrekende Host-header naar niet-bestaande `config.appBaseUrl`; gebruik `appBaseUrl` (relevant voor requests zonder Host, bijvoorbeeld HTTP/1.0). Magic values zoals auditlimiet 1000 en rate limit 30 hebben geen uitgesproken beleid. Geen kwantitatieve cyclomatic-complexitymeting gedaan; de workflowfuncties hebben aantoonbaar meerdere fout- en statuspaden. Geen grote hiërarchie van betekenisloze interfaces aangetroffen.

## 4. Reliability report

Belangrijkste outage-indicatoren: F16 kan het volledige proces vastzetten; F08 maakt writes bij schaalvergroting onveilig; F03/F04/F07/F09 laten gedeeltelijk uitgevoerde workflows achter. F15 vergroot resourcebeslag tijdens storingen. JSON-corruptie, volle disk of falende mounts hebben geen bewezen herstelpad. Audit bewaart slechts de laatste 1000 records; geen duurzame incidenthistorie.

Er zijn consolelogs maar geen doorlopende request-/correlation-ID, traces, SLO-dashboard of aantoonbare alarmering in deze repo. `manual_review` en `calendar_failed` worden niet actief geëscaleerd. Fire-and-forget CRM-updates bij expiration zijn niet duurzaam en kunnen bij shutdown verdwijnen. Geen vastgelegd graceful-shutdown/drainprotocol of restore-oefening.

Voorgestelde operationele doelen: elke geaccepteerde betaling aantoonbaar gekoppeld aan een booking en vervolgtaak; alarm op niet-bevestigde betaalde boekingen; recoveryqueue met leeftijd, pogingen en laatste fout; herstelrunbook met databasebackup en reconciliatie tegen provider/agenda. Stel concrete SLO-waarden vast op basis van werkelijk gebruik, niet op willekeurige miljoenenclaims.

## 5. Performance en database report

| Pad | Kosten/risico | Verbetering |
|---|---|---|
| `withDb` | O(D) I/O en JSON-allocaties per mutatie, één writer | Transactionele records en gerichte queries |
| Assignment merge | O(N×M) door geneste zoekactie | Maps, O(N+M), unieke databasekey |
| Availability | O(S×B) overlaps voor S slots en B intervallen; alle historische bookings geladen | Tijdvensterquery en intervalindex |
| Adminlijst | O(B log B), ongepagineerde volledige respons | Cursorpaginatie en beperkte DTO |
| Importopslag | Ruwe descriptions plus onbeperkte historie in dezelfde JSON | Aparte tabellen/context en retentie |
| Rate-limit-map | O(I) geheugen voor alle ooit geziene sleutels | TTL en maximumcapaciteit |
| Externe boekingsketen | Meerdere sequentiële roundtrips; herhaalde agendacheck | Deadlines en duurzame async synchronisatie |

Geen SQL-schema, migrations, foreign keys, pgvector, embeddings of reranker aanwezig in deze rootapp; beoordeling van HNSW/IVFFlat is niet van toepassing. Het equivalente datarisico is het ontbreken van unieke constraints, foreign keys en optimistic locking in JSON. Geen klassieke ORM-N+1-query aangetroffen; wel de expliciete kwadratische merge.

Voor Postgres: booking-, payment-, consent-, assignment- en outboxtabellen, unieke provider-ID's, `(source,external_id)`, tijdvensterconstraints en veilige backfill met validatie vóór omschakeling. Ontwerp bewaartermijnen, verwijdering en auditgeschiedenis apart. Geen bewijs van privacyverwijderingsprocedure of backupretentie; dit is een technisch governancegat, geen juridisch oordeel.

Frontend bevat geen componentframework; geen aanwijzing dat frameworkoptimalisatie de belangrijkste winst oplevert. Racepreventie bij availability en paginatie leveren eerder waarde. CPU-/RAM-/latencycijfers zijn niet gemeten.

## 6. Security report

De concrete kritieke kwetsbaarheid is F01; voorspelbare deploymentdefaults en de proxytrust van de limiter volgen. Admin heeft één gedeeld bearer-token zonder individuele rollen of herleidbare actor. Dat kan voor een kleine interne installatie volstaan, maar voldoet niet aan enterprise-eisen voor individuele intrekking en privilegeverdeling. Geen bewijs van actieve tokenlekken of actuele dependency-CVE's verzameld.

Webhookverificatie bij Mollie is positief. Voor aanvullende invariantbescherming moet de handler payment-ID, bedrag en valuta vergelijken met de lokaal verwachte payment vóór statusovergang; de huidige code vertrouwt metadata voor de koppeling. Dit is een hardeningpunt, geen aangetoonde mogelijkheid voor een willekeurige buitenstaander om providerbetalingen te vervalsen.

Geen upload- of deserialisatie-executiepad aangetroffen. Integratie-URLs komen uit env, niet rechtstreeks uit gebruikersinput; geen concrete SSRF-keten vastgesteld. `descriptionHtml` blijft onbetrouwbare brondata en moet bij toekomstig renderen gesanitiseerd worden; er is nu geen bewezen renderpad. Admin gebruikt HTML-escaping. Geen generieke claim van SQL-injection bij deze JSON-opslag.

OWASP/Zero Trust-gerelateerde gaten: public/private-bestandsgrens, onvoldoende begrenzing van verkeer en configuratie, gedeelde beheeridentiteit. ISO 27001/NIS2-gerelateerde technische aandachtspunten: wijzigingsbeheer, toegangsbeheer, monitoring, incidentbewijs, back-up/herstel en dependencybeheer. Toepasselijkheid of compliance kan niet uit deze repository worden gecertificeerd.

## 7. Technical debt en test report

| Schuldtype | Kortetermijnschuld | Langetermijnrisico | Prioriteit |
|---|---|---|---|
| Technisch | Handmatige kalenderparser, dubbele buffers | Steeds meer kalenderedgecases en dubbele boekingen | F05/F06/F17 |
| Architectuur | Statusstrings en side effects door elkaar | Nieuwe flows breken bestaande overgangen | F02–F04/F07/F09 |
| Data | Eén JSON-document | Verlies bij replicas, O(D)-writes | F08 |
| Operationeel | Status zonder worker/alerts | Onzichtbare achterstand en handmatig herstel | F03/F11/F18 |
| Security | Repository als public root | Blootstelling van nieuw toegevoegde bestanden | F01 |
| Delivery | Variabele imageversies, defaults | Niet-reproduceerbare of onveilige deployments | F19 |

### Testbewijs

`npm test`: 9 tests, 9 geslaagd, 0 mislukt. Vijf processcenario's gebruiken geïsoleerde tijdelijke opslag en lokale CRM/Mollie/CalDAV-stubs; vier tests controleren importerfuncties. Er zijn geen echte browser-E2E-, providercontract-, crash-recovery- of loadtests aangetroffen. De scenario's zetten buffer op nul en tijdzone op UTC, waardoor twee belangrijke productiedimensies ontbreken.

De importer-test met titel “rejects incomplete imports” test feitelijk een succesvolle volledige import; hij bevat geen rejectionassertie. Titel en dekkingsclaim lopen uiteen.

Gerichte extra controles, zonder wijziging van applicatiecode:

- HTTP `/server.js` -> 200, 58.941 tekens; `/.gitignore` -> 200.
- Resolver accepteert default DB-pad; geen echte klantdata opgevraagd.
- Amsterdam TZID 12:00 -> parser 12:00Z in plaats van 10:00Z.
- Dagelijkse RRULE -> nul busy intervallen op een latere herhalingsdag.
- Geannuleerd record -> bevestigd na aanroep paid-confirmatie met gesimuleerde integraties.
- Agenda-PUT-fout -> functie resolveert, status `calendar_failed`, nul lokale blokkades.
- 100 volle bronpagina's zonder totaaltelling -> ten onrechte succesvolle return.
- Merge met 100 dezelfde IDs -> 100 opgeslagen rijen.

De directe functiereproducties draaien de gelezen serverfuncties in een geïsoleerde VM met gemockte opslag/integraties; zij zijn geen volledige providerintegratietest. Deze checks zijn eenmalig uitgevoerd en nog niet toegevoegd aan de regressiesuite. `npm test` genereert het bestaande genegeerde `test/scenario-evidence.json`.

Benodigde regressies: concurrerende paid-webhooks; cancel/confirm-race; crash na agenda-PUT; agenda- en CRM-uitval; herstart met pending tasks; publieke bestandsdenylist; DST/recurrence/hele-dag-events; overlapgrenzen; incomplete en verschuivende paginatie; stale frontendresponses. Tests moeten domeininvarianten bewijzen, niet alleen de huidige implementatie kopiëren.

## 8. Prioritized roadmap

Inspanningen zijn indicatieve werkdagen voor implementatie en gerichte verificatie; onbekende deploymentdetails kunnen deze vergroten. F01–F20 vormen de twintig afzonderlijke verbeteritems; hieronder zijn ze tot leverbare pakketten gegroepeerd.

| Termijn | Werk / bevindingen | Impact | Effort | Risicoreductie | Businesswaarde |
|---|---|---|---|---|---|
| Direct | Public directory en regressietests, F01 | Zeer hoog | 0,5–1 dag | Stopt nieuwe bestandsblootstelling | Beschermt klantdata en vertrouwen |
| Direct | Terminale statusbewaking, betaald slot vasthouden, F02/F03 | Zeer hoog | 1–3 dagen | Voorkomt herlevende annuleringen en vrije betaalde slots | Minder financiële/supportincidenten |
| Direct | Configvalidatie en verplichte deploysecrets, F16/F19 | Hoog | 0,5–1 dag | Voorkomt bekende startup-/loopfouten | Veiliger deployen |
| 30 dagen | Calendarsemantiek en één bufferbeleid, F05/F06/F17 | Zeer hoog | 3–6 dagen | Minder dubbele of onterecht geblokkeerde afspraken | Meer betrouwbare capaciteit |
| 30 dagen | Bevestigingsclaim en duurzaam integratieherstel, F04/F07/F09/F11 | Zeer hoog | 5–10 dagen | Herstel na crashes en dependency-uitval | Betalingen zonder handmatige nazorg |
| 30 dagen | Veldspecifieke CRM-patches, F10 | Hoog | 1–2 dagen | Behoud van contact-/consentdata | Betrouwbare klantadministratie |
| 30 dagen | Volledigheidsbewijs en unieke import, F12/F13 | Hoog | 1–3 dagen | Geen massale foutieve deactivatie | Juist opdrachtenaanbod |
| 30 dagen | Trafficgrenzen, deadlines en UI-race, F14/F15/F20 | Middel/hoog | 2–4 dagen | Minder resource-uitputting en gebruikersfouten | Snellere, voorspelbare bediening |
| 90 dagen | Transactionele opslag en constraints, F08 | Zeer hoog | 5–10 dagen | Lost writeverlies en duplicaatinvarianten op | Veilige groei en deployments |
| 90 dagen | Readiness, metrics, alerts en restore-oefening, F18 | Hoog | 3–5 dagen | Kortere detectie- en hersteltijd | Minder omzetverlies bij storing |
| 90 dagen | Modules plus fout-/concurrentie-/contracttests | Hoog | 4–8 dagen | Minder regressies bij functionele wijzigingen | Hogere wijzigingssnelheid |
| 6 maanden | Gemeten SLO's, belastingsproeven, capaciteitsplan | Hoog | 5–10 dagen, daarna periodiek | Onderbouwde schaalgrenzen | Voorspelbare kosten en groei |
| 6 maanden | Retentie, individuele adminrechten, audit-/dependencybeleid | Hoog | 5–10 dagen | Minder privacy- en beheerfouten | Overdraagbaar en controleerbaar beheer |

Vrijgavecriteria: betaalde boekingen blijven herstelbaar en blokkeren hun tijdslot; duplicate delivery verandert geen terminale toestand; bestaande calendar-voorkomens worden correct meegenomen; alleen publieke assets zijn bereikbaar; deployment en herstel zijn aantoonbaar getest. Pas daarna aantallen replicas of verkeersvolume verhogen.

## 9. Remediation status

The findings above describe the pre-remediation working tree. The implementation on the audit branch
addresses F01–F20 as follows:

| Finding | Remediation evidence |
|---|---|
| F01 | Explicit public-file allowlist, real-path containment and HTTP regressions for repository/database paths |
| F02 | Guarded cancellation state; paid replay becomes `refund_review`; regression test included |
| F03 | Paid failure states continue reserving the slot and durable confirmation jobs retry |
| F04 | Leased durable jobs, deterministic event UID, existing-event verification and duplicate-webhook regression |
| F05/F06 | Standards-based iCalendar parser with recurrence, exceptions, TZID, all-day and duration support |
| F07 | Payment creation uses an idempotency key; CRM projection is an independent durable job |
| F08 | Indexed SQL store supports SQLite locally and Postgres with cross-process transaction locking |
| F09 | Cancellation remains `cancel_requested` until calendar deletion succeeds; retry is visible |
| F10 | Booking patches omit consent fields and blank signup data does not erase known contact fields |
| F11 | Newsletter synchronization uses a durable retry job and exposes exhausted work through health/admin APIs |
| F12/F13 | Import requires a proven completion signal and stable total, rejects duplicate IDs, and merges in O(N+M) |
| F14 | Bounded TTL rate limiter with an explicit trusted-proxy boundary and separate endpoint budgets |
| F15 | Deadlines, response-size/concurrency bounds and durable retry semantics for integrations |
| F16 | Startup validation rejects invalid ranges, time zones, workdays and production secrets |
| F17 | Raw stored intervals receive one candidate-side buffer; exact-boundary regression included |
| F18 | Separate liveness/readiness endpoints, writable-store probe, dead-job and import-freshness reporting, structured request IDs |
| F19 | Required deployment secrets and exact EspoCRM, MariaDB, Radicale and bcrypt versions |
| F20 | Browser request sequencing ignores stale availability responses and booking create is idempotent |

Verification after remediation includes the Node test suite, dependency audit, a local Postgres
cross-pool concurrency run, static-file HTTP probes and configuration startup checks. Production
deployment still requires valid secrets, Postgres configuration, monitoring alerts and a backup
restore exercise by the operator.
