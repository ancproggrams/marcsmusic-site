# Prompt: audit bestaande bronnen en pas De Transparante Broker aan op het actieve ZZP-filter

## Bevestigde productiecontext: Railway Matcha

Voer deze opdracht uit in het Railway-project `matcha`, production, service `scraper`. De relevante
gedeployde bestanden zijn reeds vastgesteld:

- `app/services/scraper_factory.py`
- `app/core/scrapers/detransparantebroker_api.py`
- `app/core/jobs/zzp_exclusion.py`
- `app/services/zzp_detection_service.py`
- `app/core/jobs/preparation.py`
- `app/activities/scraping/scraping_activities.py`
- `app/services/job_save_service.py`
- `app/api/v1/jobs.py`
- `app/services/matching_service.py`

De factory registreert `scraper_key == "detransparantebroker"` al naar
`DetransparantebrokerApiScraper`. Maak dus geen tweede scraper of losstaande databaseflow.
Verbeter de bestaande Matcha-implementatie en haar tests.

Productielogs bevestigen dat bron-ID `5132` (`De Transparante Broker`) ieder uur draait en momenteel
167 opdrachten per run verwerkt. Gebruik dit als nulmeting en rapporteer waarom records daarna wel
of niet actief en zichtbaar zijn.

## Rol en doel

Je werkt als senior data-ingestion engineer. Onderzoek eerst hoe **alle bestaande opdrachtbronnen en
scrapers** in deze codebase bepalen of een opdracht actief, geschikt voor zelfstandige zzp'ers en
inhoudelijk toegestaan is. Gebruik die bestaande productieflow als bron van waarheid. Pas daarna
de scraper/importer voor **De Transparante Broker** aan.

Ga niet uit van alleen een boolean van de bron. De zichtbare voorwaarden, eisen, beschrijving,
metadata en het centrale actieve filter kunnen elkaar tegenspreken. Een expliciete uitsluiting voor
zzp'ers heeft altijd voorrang op een positieve of ontbrekende bronindicator.

## Stap 1 — vind de echte implementaties

Doorzoek de volledige repository, inclusief workers, cronjobs, queues, serverless functions,
scraperpackages, shared libraries, database-repositories, migrations en tests.

Inventariseer per bron:

- scraper/importer-entrypoint;
- scheduler, queue of crontrigger;
- bronadapter en normalisatie;
- centrale actieve-filterfunctie;
- ZZP-toelatingsfunctie;
- categorie- en uitsluitingsfilters;
- deduplicatie/upsert;
- database-entiteit, enumwaarden en migraties;
- redenvelden voor acceptatie of afwijzing;
- relevante tests en fixtures.

Als deze implementaties niet in de huidige repository staan, stop dan met implementeren en rapporteer
welke repository, service of package ontbreekt. Verzin geen parallel filtersysteem.

## Stap 2 — vergelijk alle bronregels

Maak een compacte vergelijkingsmatrix met minimaal:

| Bron | Actief-regel | ZZP-regel | Tekstuele uitsluitingen | Contractvormfilter | Deadline-regel | Opslag van afwijsreden |
|---|---|---|---|---|---|---|

Leg verschillen en inconsistenties bloot. Bepaal welke gedeelde functie daadwerkelijk door alle
bronnen hoort te worden gebruikt. Kopieer geen losse keywordlijsten als al een centrale policy
bestaat.

## Stap 3 — vereiste beslisvolgorde

Laat De Transparante Broker exact dezelfde centrale filterpipeline gebruiken als de andere bronnen.
De beslisvolgorde moet minimaal zijn:

1. Bronrecord is openbaar, niet geobfusceerd en technisch geldig.
2. Opdracht is nog actief volgens dezelfde deadline- en statusregels als andere bronnen.
3. Opdracht is expliciet geschikt voor een zelfstandige zzp'er.
4. Geen tekstveld bevat een harde ZZP-uitsluiting.
5. De contractvoorwaarden laten zelfstandige uitvoering daadwerkelijk toe.
6. Pas daarna normaliseren en als actief opslaan/upserten.

Een record dat één harde uitsluitingsregel raakt, mag niet door een positieve regel opnieuw worden
toegelaten.

## Stap 4 — ZZP-policy

Gebruik bestaande gedeelde policy, enums en reden-codes. Als deze aantoonbaar ontbreken, maak één
centrale, brononafhankelijke functie met een verklaarbaar resultaat, bijvoorbeeld:

```text
evaluateAssignment(rawAssignment) ->
{
  accepted: boolean,
  reasonCode: string,
  evidence: string[],
  normalizedCategory: string | null
}
```

Voor De Transparante Broker geldt:

- `freelancerAllowed === "YES"` is noodzakelijk, maar niet zelfstandig voldoende.
- `NO`, `UNKNOWN`, `null` of een ontbrekende waarde wordt standaard niet actief toegelaten.
- Inspecteer alle betekenisvolle tekstvelden, waaronder titel, omschrijving, eisen, wensen,
  voorwaarden, procedure en eventuele losse lijsten.
- Harde uitsluitingen omvatten minimaal varianten zoals:
  - `niet toegestaan voor zzp`;
  - `niet geschikt voor zzp`;
  - `geen zzp`;
  - `zzp niet mogelijk`;
  - `kan niet worden ingevuld door een zzp'er`;
  - `uitsluitend in loondienst`;
  - `detachering in loondienst verplicht`;
  - `payroll`, `dienstverband` of `loondienst` wanneer dit als verplichte contractvorm staat;
  - `doorleenconstructie` waarbij zelfstandig aanbieden wordt uitgesloten;
  - alleen omzetverloning, wanneer de centrale bedrijfsregel dit niet als zelfstandige ZZP-opdracht
    accepteert.
- Match hoofdletterongevoelig, Unicode-genormaliseerd en robuust voor `zzp`, `zzp'er`, `zzp’er`,
  `zelfstandige` en meervoudsvormen.
- Gebruik contextbewuste patronen. Een tekst als “ZZP toegestaan” mag niet door het losse woord
  “zzp” worden afgewezen.

## Stap 5 — contractvoorwaarden

Controleer of de aangeboden contractvorm werkelijk zelfstandige uitvoering toestaat. Filter dat
soort opdrachten uit wanneer loondienst, detachering, payroll of een andere niet-zelfstandige
constructie verplicht is. Gebruik de bestaande centrale reden-codes en voorkom dat algemene
informatieve vermeldingen zonder verplichtend karakter tot false positives leiden.

## Stap 6 — opslaggedrag

- Niet-toegestane records mogen niet als actieve opdracht beschikbaar komen.
- Volg exact het bestaande gedrag voor afgewezen records:
  - niet opslaan, of
  - inactief opslaan met reden-code,
  afhankelijk van de centrale architectuur.
- Bestaande Transparante Broker-records die niet door het nieuwe filter komen, moeten bij de eerstvolgende
  volledig geslaagde synchronisatie inactief worden.
- Verwijder geen historie.
- Bewaar minimaal bron-ID, bron, evaluatietijdstip, reden-code en bewijs indien andere bronnen dat ook doen.
- Upserts blijven idempotent en een gedeeltelijk mislukte synchronisatie mag geen records deactiveren.

## Stap 7 — tests

Voeg table-driven tests toe voor:

- expliciet `freelancerAllowed: YES` zonder uitsluiting: geaccepteerd;
- `NO`, `UNKNOWN`, null en ontbrekend: afgewezen;
- `YES` plus “niet toegestaan voor zzp'ers”: afgewezen;
- “uitsluitend in loondienst”: afgewezen;
- verplichte detachering/payroll/omzetverloning volgens centrale policy: correct afgewezen;
- “ZZP toegestaan”: niet per ongeluk afgewezen;
- verplichte loondienst, detachering of payroll: afgewezen;
- niet-verplichtende uitleg over mogelijke contractvormen: niet per ongeluk afgewezen;
- verlopen deadline/inactieve opdracht: afgewezen;
- opnieuw synchroniseren maakt geen duplicaten;
- afgewezen bestaand record wordt inactief;
- mislukte of gedeeltelijke sync deactiveert niets.

Gebruik daarnaast echte, geanonimiseerde fixtures van minimaal drie andere bronnen en De Transparante
Broker om policy-pariteit te bewijzen.

## Vereiste oplevering

Lever:

1. repositorybrede inventarisatie van bronnen, scrapers en centrale filters;
2. vergelijkingsmatrix;
3. aangetroffen architectuur- en policyverschillen;
4. concrete root cause;
5. gewijzigde bestanden en migraties;
6. testresultaten;
7. aantallen vóór filtering, per afwijsreden en na filtering;
8. een live of fixture-gebaseerde verificatie dat uitsluitend actieve opdrachten met toegestane
   zelfstandige contractvoorwaarden beschikbaar zijn.

Markeer de wijziging niet als gereed wanneer alleen `freelancerAllowed` is gecontroleerd of wanneer
een nieuwe lokale keywordfilter is gemaakt zonder vergelijking met de andere productiebronnen.
