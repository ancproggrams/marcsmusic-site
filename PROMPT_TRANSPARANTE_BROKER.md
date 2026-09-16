# Herstelprompt: opdrachten van De Transparante Broker ontbreken

Onderzoek en herstel de volledige synchronisatie van opdrachten van De Transparante Broker naar de lokale database.

Voer vóór implementatie ook de repositorybrede bron- en filteraudit uit
`PROMPT_AUDIT_ZZP_SOURCE_FILTERS.md` uit. Alleen actieve opdrachten die volgens de gedeelde
productiepolicy daadwerkelijk voor zelfstandige zzp'ers zijn toegestaan, mogen actief worden
opgeslagen. Opdrachten met voorwaarden die zelfstandige uitvoering uitsluiten, moeten via dezelfde
centrale policy als de andere bronnen worden uitgefilterd.

Acceptatiecriteria:

1. Gebruik uitsluitend het publieke opdrachten-endpoint van `https://www.detransparantebroker.nl`.
2. Haal alle pagina's op en accepteer geen gedeeltelijke synchronisatie.
3. Normaliseer bronrecords naar een expliciet lokaal opdrachtmodel met een stabiele sleutel in de vorm `de-transparante-broker:<extern-id>`.
4. Sla opdrachten idempotent op: opnieuw synchroniseren mag geen duplicaten maken.
5. Markeer alleen na een volledig geslaagde synchronisatie verdwenen bronrecords als inactief; verwijder historische records niet.
6. Bewaar `firstSeenAt`, `lastSeenAt`, `updatedAt`, bron-URL en synchronisatiestatus.
7. Bescherm handmatige synchronisatie en uitlezen met bestaande admin-authenticatie.
8. Stel netwerk-time-outs in, voorkom parallelle synchronisaties en log succes of falen in de audittrail.
9. Laat productie automatisch bij opstarten en daarna periodiek synchroniseren; maak dit configureerbaar via environment variables.
10. Voeg tests toe voor normalisatie, paginatie, deduplicatie, idempotentie en deactivatie.
11. Controleer niet alleen `freelancerAllowed`, maar ook titel, beschrijving, eisen, voorwaarden en
    overige tekstvelden op expliciete uitsluiting van zzp'ers.
12. Gebruik de bestaande centrale ZZP-policy; maak geen afwijkende bronlokale policy.

Lever de oorzaak, gewijzigde bestanden, testresultaten en eventuele deployment-configuratie op.
