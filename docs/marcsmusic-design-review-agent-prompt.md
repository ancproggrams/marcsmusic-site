# MarcsMusic design-review uitvoeringsprompt

Je werkt als senior product designer, frontend engineer en accessibility reviewer aan `marcsmusic.nl`.

## Doel

Voer de bestaande designreview uit zonder de site opnieuw te ontwerpen. Behoud de persoonlijke artiest-identiteit, het zwart/wit/pastelblauwe systeem, serif headlines, mono-labels, bio, playlist, delen/downloaden, deeplinks en accessibility-basics.

## Prioriteiten

1. Maak de mobiele sticky header aanzienlijk compacter. Houd `Luister` en `Bookings` direct prominent; verberg of vereenvoudig secundaire navigatie zonder functionaliteit te verliezen.
2. Breng luisteren mobiel eerder in beeld: hero-copy eerst, daarna de player als eerste grote functionele blok, daarna pas de uitgebreide bio. Desktop moet zijn sterke tweekolomscompositie behouden.
3. Toon slechts één primaire audiobediening. De custom controls blijven leidend; native audio mag alleen een semantische/technische fallback zijn en niet dubbel zichtbaar.
4. Voeg direct onder de hero-intro een compacte nieuwste/populaire-track treatment toe die naar de player leidt en een memorabel MarcsMusic-moment creëert.
5. Geef Bookings overal betekenisvolle context, bijvoorbeeld `DJ-set, event of studio-aanvraag`, met een duidelijke commerciële route.
6. Corrigeer sticky-header anker-offsets voor `#listen` en andere secties op mobiel.
7. Gebruik echte track-artwork als die lokaal bestaat; anders maak je met bestaande assets en CSS een onderscheidende, rustige cover treatment. Geen externe stockbeelden.

## Kwaliteitseisen

- Mobile-first vanaf 320px; geen horizontale overflow.
- Semantische HTML, geldige CSS en JavaScript zonder syntaxfouten.
- Keyboardbediening, focus-visible, correcte labels, reduced-motion respecteren en minimaal WCAG AA contrast.
- Geen regressies in playlist, play/pause, vorige/volgende, scrubber, delen, downloaden, deeplinks, nieuwsbrief en boekingsflow.
- Beperk wijzigingen tot de toegewezen bestanden en behoud bestaande gebruikerswijzigingen.
- Lever concrete verificatie: syntaxchecks, relevante tests en browser-/DOM-controles waar mogelijk.

## Acceptatiecriteria

- Op mobiel blijft de header compact in één rij en neemt hij duidelijk minder verticale ruimte in.
- Binnen de eerste mobiele viewport is een luisteractie of track-highlight zichtbaar; de player staat vóór de lange bio.
- Er zijn niet twee zichtbare sets audiocontrols.
- Bookings heeft korte context naast een duidelijke CTA.
- `#listen` landt zichtbaar onder de sticky header.
- Desktop blijft coherent en alle bestaande kernfunctionaliteit werkt.
