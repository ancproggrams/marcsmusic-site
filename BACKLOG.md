# Backlog

## SEO en AEO uitbreiden

Status: eerste fase live

De basis staat: canonieke pagina's, structured data met live prijzen,
antwoordblokken, een eigen deelafbeelding, `robots.txt`, `sitemap.xml` en
`llms.txt`. De vervolgstappen staan met motivatie in
[`docs/seo-aeo.md`](docs/seo-aeo.md), paragraaf 9. Eerst aan de beurt:

- Search Console en Bing Webmaster verifiëren met `GOOGLE_SITE_VERIFICATION` en
  `BING_SITE_VERIFICATION`, daarna de sitemap indienen;
- eigen pagina per track met `MusicRecording`, songtekst en verhaal;
- vingerafdruk in de URL van `styles.css` en de scripts voor lange caching.

## Donaties via Mollie opnieuw introduceren

Status: uitgesteld

De publieke donatieoptie is voorlopig verwijderd. Bestaande Mollie-betalingslogica
voor boekingen en de afhandeling van eerder gestarte donaties blijven behouden.

Voor herintroductie:

- bepaal positionering, teksten en vaste of vrije bedragen;
- voeg expliciete product- en juridische acceptatiecriteria toe;
- activeer de publieke aanmaak- en statusroutes opnieuw;
- herstel de toegankelijke interface en regressietests;
- valideer de volledige Mollie-flow eerst in testmodus en daarna in productie.
