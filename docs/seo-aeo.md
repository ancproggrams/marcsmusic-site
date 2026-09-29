# SEO en AEO voor marcsmusic.nl

Dit document beschrijft het startprogramma voor vindbaarheid van MarcsMusic in
zoekmachines (SEO) en in antwoordmachines zoals Google AI-overzichten, ChatGPT,
Perplexity en Copilot (AEO). Het legt vast wat nu live staat, welke regels gelden
voor teksten en data, en wat de volgende stappen zijn.

## 1. Uitgangspunt

- Eén publiek domein: `https://www.marcsmusic.nl`.
- Twee publieke pagina's: de homepage (luisteren en bio) en `/booking` (boeken).
- Eén taal en markt: Nederlands, boekingen binnen Nederland, agenda in
  `Europe/Amsterdam`.
- Twee zoekintenties die geld of bereik opleveren:
  1. commercieel: iemand zoekt een DJ of muziek voor een feest, event of studio;
  2. merk- en muziekintentie: iemand zoekt MarcsMusic, Marc of een tracktitel.
- `/admin`, `/api/*` en de Mollie-retourroutes horen in geen enkele index.

## 2. Eén bron van waarheid

Alle SEO- en AEO-data staat in `src/seo/site-seo.mjs`: de entiteit, de pagina's
met titel, beschrijving en wijzigingsdatum, de boekbare diensten en de
antwoordblokken. Daaruit worden gegenereerd:

| Bestand | Inhoud |
| --- | --- |
| `src/seo/page-markup.mjs` | head-metadata (title, description, canonical, robots, Open Graph, Twitter) en de JSON-LD graph, plus de zichtbare FAQ-blokken |
| `src/seo/seo-documents.mjs` | `robots.txt`, `sitemap.xml` en `llms.txt` |
| `src/seo/runtime-seo.mjs` | het aanbod met live prijzen en de verificatietags voor zoekconsoles |
| `scripts/sync-seo-metadata.mjs` | schrijft de gegenereerde regio's in `index.html` en `booking.html` en controleert op drift |

`index.html` en `booking.html` bevatten daarom gemarkeerde, gegenereerde blokken
(`<!-- seo:head:start -->` en `<!-- seo:faq:start -->`). Handmatig wijzigen binnen
die blokken heeft geen zin: de test `tests/seo-aeo.test.mjs` faalt dan op drift.

Daarnaast staat in beide pagina's de hook `<!-- seo:runtime -->`. De server vult
die bij het opstarten met de gegevens die niet in de repository thuishoren: het
aanbod met de live prijzen uit de boekingsconfiguratie en de verificatietags uit
de omgevingsvariabelen. Ontbreekt de hook, dan start de site niet; een pagina die
hem stil verliest zou prijzen publiceren die niemand meer bijhoudt.

## 3. Zoekwoord- en vraagmatrix

| Cluster | Voorbeeldzoekopdrachten | Doelpagina | Status |
| --- | --- | --- | --- |
| Merk en entiteit | marcsmusic, marcsmusic marc, marcsmusic muziek | `/` | live: `MusicGroup`, `WebSite`, `sameAs` naar Instagram, X en Spotify |
| Muziek beluisteren | man den man nummer, curaçao radio edit beluisteren | `/` | live: `MusicPlaylist` met acht `MusicRecording`-items |
| DJ boeken | dj boeken, dj huren feest, dj met eigen muziek | `/booking` | live: `Service` per boekingstype |
| Eventmuziek | muziek voor event, live muziek programma | `/booking` | live: `Service` eventmuziek |
| Studiosessie | studiosessie boeken, samen muziek opnemen | `/booking` | live: `Service` studiosessie |
| Vraagintentie (AEO) | wat kost een dj boeken, hoe boek ik een dj, worden reiskosten gerekend | `/booking` | live: acht antwoordblokken plus `FAQPage` |

Nieuwe clusters horen eerst in deze tabel en in `src/seo/site-seo.mjs`, daarna in
de pagina's. Een cluster zonder eigen pagina of eigen antwoordblok is geen
cluster maar een wens.

## 4. Regels voor antwoordblokken

Antwoordmachines citeren korte, op zichzelf staande passages. Daarom geldt voor
elk blok in `FAQ_ENTRIES`:

1. De vraag staat in de vorm waarin iemand hem stelt en noemt de entiteit
   (`MarcsMusic`), zodat het antwoord ook los van de pagina herkenbaar is.
2. Het antwoord is tussen 80 en 320 tekens, begint met het antwoord zelf en
   heeft geen verwijzing nodig naar "hierboven" of "zie de tabel".
3. Het antwoord bevat geen bedragen, tarieven of doorlooptijden. Die waarden
   komen uit omgevingsvariabelen (`BOOKING_PRICE_*`, `BOOKING_TRAVEL_RATE_*`,
   `BOOKING_MIN_LEAD_HOURS`) en zouden in geciteerde tekst blijven staan nadat ze
   in productie zijn gewijzigd. Het antwoord beschrijft daarom het gedrag: de
   boekingsmodule toont duur, prijs en reiskosten voordat er betaald wordt.
4. Elk antwoord staat zichtbaar op de pagina. De `FAQPage`-graph bevat exact
   dezelfde tekst; verborgen antwoorden zijn een richtlijnovertreding en worden
   door de test geblokkeerd.

Dezelfde antwoorden staan in `llms.txt`, zonder markup, zodat een ophaalstap ze
kan citeren zonder de pagina te reconstrueren.

## 5. Technische basis die nu live staat

- **Canonical per pagina**: `https://www.marcsmusic.nl/` en
  `https://www.marcsmusic.nl/booking`.
- **Permanente redirects**: `/index.html`, `/booking.html` en `/admin.html`
  antwoorden met `301` naar het canonieke pad, zodat dubbele URL's samenvallen.
- **Interne links** gebruiken alleen de canonieke paden.
- **`robots.txt`** opent de publieke pagina's voor zoekmachines en voor de
  ophaalcrawlers van antwoordmachines, en sluit `/admin`, `/api/`, de
  Mollie-retourroutes en de download-variant van de audio af. Elke benoemde
  crawlergroep herhaalt die regels, omdat een benoemde groep de `*`-groep volledig
  vervangt.
- **`sitemap.xml`** bevat alleen de canonieke pagina's met een gecureerde
  `lastmod`.
- **`llms.txt`** is de platte-tekstbriefing voor antwoordmachines.
- **Structured data** per pagina: `WebSite`, `MusicGroup` met `sameAs`, `WebPage`,
  op de homepage `MusicPlaylist`, op `/booking` drie keer `Service`,
  `BreadcrumbList` en `FAQPage`.
- **Aanbod met live prijzen**: `/booking` krijgt een tweede JSON-LD-blok met één
  `Offer` per boekingstype, met prijs, valuta, btw-status, de duur als
  `referenceQuantity` in minuten en de reiskosten per uur als `addOn`. Die
  waarden komen uit dezelfde configuratie als `/api/booking/config`, dus ze
  kunnen niet uit elkaar lopen. Een boekingstype zonder gekoppelde dienst wordt
  overgeslagen in plaats van half gepubliceerd.
- **Eigendomsbewijs**: `GOOGLE_SITE_VERIFICATION` en `BING_SITE_VERIFICATION`
  worden als meta-tag in beide pagina's gerenderd. Een token dat niet aan het
  strikte patroon voldoet, laat de start falen in plaats van stil te verdwijnen.
- **Deelbaarheid**: Open Graph en Twitter-kaarten met een eigen deelafbeelding
  van 1200 x 630 (`assets/og-marcsmusic.jpg`), inclusief afmetingen, zodat
  previews het vierkante portret niet onvoorspelbaar afsnijden.
- **Snelheid**: de pagina's, `styles.css`, `app.js` en `booking.js` worden bij het
  opstarten in het geheugen gezet met een Brotli- en een gzip-variant, en op
  `Accept-Encoding` uitgeleverd met `Vary: accept-encoding`. Fonts en de
  audiobestanden mogen dertig dagen gecacht worden; de stylesheet en scripts
  houden een korte levensduur omdat hun URL geen vingerafdruk bevat.
- **Niet indexeren**: `noindex` in de admin-pagina, `X-Robots-Tag` op de
  admin-respons, op de Mollie-retourroutes en op elke JSON-API-respons.
- De crawl-documenten worden opgebouwd uit `APP_BASE_URL` en nooit uit de
  `Host`-header, zodat een vervalste header geen sitemap of canonieke oorsprong
  kan publiceren die MarcsMusic niet beheert.

## 6. Runbook: wijzigingen doorvoeren

1. Pas `src/seo/site-seo.mjs` aan (titel, beschrijving, dienst, antwoordblok).
2. Werk `lastModified` van de betrokken pagina bij wanneer de inhoud echt is
   gewijzigd. Die datum is bewust gecureerd: een deploytijd of bestandsdatum zou
   versheid melden die de inhoud niet heeft.
3. Run `npm run seo:sync` en bekijk de diff in `index.html` en `booking.html`.
4. Run `npm test`. De SEO-suite controleert drift, canonical, structured data,
   de pariteit tussen zichtbare antwoorden en `FAQPage`, `robots.txt`,
   `sitemap.xml`, `llms.txt`, de redirects en de noindex-headers.
5. Na deploy: controleer `https://www.marcsmusic.nl/robots.txt`,
   `/sitemap.xml` en `/llms.txt`, en valideer beide pagina's in de Rich Results
   Test en de Schema Markup Validator.

Controleren zonder te schrijven kan met `npm run seo:check`.

De deelafbeelding is een uitsnede van het portret en wordt gemaakt met ffmpeg,
niet met een projectafhankelijkheid:

```text
ffmpeg -y -i assets/portrait-full.png \
  -vf "crop=iw:iw/1.9048:0:ih*0.12,scale=1200:630:flags=lanczos,\
drawtext=fontfile=assets/fonts/roboto-flex.ttf:text='Eigen muziek van Marc':fontcolor=0x111c22:fontsize=52:x=88:y=330,\
drawtext=fontfile=assets/fonts/roboto-flex.ttf:text='Luisteren en boeken op marcsmusic.nl':fontcolor=0x42555f:fontsize=30:x=90:y=404" \
  -frames:v 1 -q:v 2 assets/og-marcsmusic.jpg
```

Werk na een nieuwe afbeelding ook `SITE_ENTITY.shareImage` bij; de test
controleert de echte afmetingen van het bestand tegen die waarden.

## 7. Meten

- Google Search Console: property voor `https://www.marcsmusic.nl` aanmaken. Het
  eigendom kan worden bewezen met de meta-tagmethode: zet het token uit Search
  Console als Railway-variabele `GOOGLE_SITE_VERIFICATION`, deploy, en klik
  daarna op Verifiëren. Dien vervolgens de sitemap in en volg wekelijks de
  rapporten Prestaties (splits op vraagwoorden zoals "hoe", "wat kost"),
  Indexering en Rich results.
- Bing Webmaster Tools: zelfde werkwijze met `BING_SITE_VERIFICATION`, en
  dezelfde sitemap; dit voedt ook Copilot.
- Serverlogboek: verzoeken van `GPTBot`, `OAI-SearchBot`, `PerplexityBot` en
  `ClaudeBot` laten zien of de antwoordmachines de pagina's en `llms.txt`
  ophalen.
- Boekingsdata: het aantal gestarte en betaalde boekingen per week is de enige
  uitkomst die telt; posities zijn een tussenstap.

## 8. Bewuste keuzes

- **Antwoordmachines zijn welkom.** Geciteerd worden is het doel van dit
  programma. De crawlers staan expliciet in `robots.txt`, zodat een eventuele
  opt-out één regel per crawler is in plaats van een herschreven beleid.
- **Prijzen alleen als runtime-data.** Een vast bedrag in de statische pagina of
  in een antwoordblok zou gaan afwijken van de omgevingsconfiguratie. De
  bedragen staan daarom uitsluitend in het `Offer`-blok dat de server uit die
  configuratie rendert, en de geciteerde antwoordteksten blijven bedragvrij.
- **Geen `hreflang`.** De site is uitsluitend Nederlands; een taalcluster zonder
  tweede taalversie voegt niets toe.
- **Geen beoordelingen of sterren.** `AggregateRating` mag alleen met echte,
  verifieerbare beoordelingen en is daarom nog niet aanwezig.
- **De canonical in de pagina's verwijst altijd naar productie.** De HTML is
  statisch, dus een testomgeving verwijst naar `https://www.marcsmusic.nl`. Dat is
  gewenst: een omgeving die niet het publieke domein is, moet geen eigen index
  opbouwen. De crawl-documenten volgen wel `APP_BASE_URL` van de omgeving.

## 9. Volgende stappen

1. Search Console en Bing Webmaster inrichten: token als Railway-variabele
   zetten, verifiëren en de sitemap indienen. Dit is de enige stap die niet in
   code kan worden afgerond.
2. Eigen pagina per track met `MusicRecording`, songtekst en verhaal; dat opent
   de long tail rond de titels en geeft interne links naar `/booking`. Dit vraagt
   echte tekst per nummer, geen gegenereerde vulling.
3. Publieke, bevestigde optredens als `Event` publiceren zodra daar een bron van
   waarheid voor is (nu staan boekingen alleen in de CRM en agenda).
4. EPK-releases in de sitemap opnemen wanneer het manifest in productie actief
   is (`docs/epk.md`).
5. Een vingerafdruk in de URL van `styles.css` en de scripts, zodat die net als
   de fonts lang gecacht kunnen worden.
6. Core Web Vitals op mobiel meten in productie en de afbeeldings- en
   audioassets daarop bijstellen.
7. Vraagintenties uitbreiden op basis van echte zoekopdrachten uit Search
   Console, volgens de regels in paragraaf 4.
