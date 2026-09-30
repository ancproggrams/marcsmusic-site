# Toetsenbordkaart Meta Business Suite

Kaart voor Instagram **marcsmusic_1** in Meta Business Suite. Bediening gaat via de adresbalk, de tekstcursor en benoemde knoppen. Pixelklikken en OCR zijn het fallback-pad als een veld geen cursor toont.

Meta publiceert geen sneltoetsenlijst voor `business.facebook.com`. De letters op [Facebook Help: keyboard shortcuts](https://www.facebook.com/help/156151771119453) (`J`, `K`, `P`, `L`, `C`, `S`, `O`, `/`, `Q`, `?`) gelden voor de Facebook-feed, en alleen buiten een tekstveld. Die letters blijven in Business Suite onaangeroerd.

De kaart is opgenomen uit de ingelogde plannersessie van 30 september 2026. Tab-tellingen zijn niet gemeten en staan hier bewust niet in.

## Account

| | |
|---|---|
| Instagram | `marcsmusic_1` |
| `business_id` | `1337401464712740` |
| `asset_id` | `1284497424727442` |
| Planner | `https://business.facebook.com/latest/content_calendar?business_id=1337401464712740&asset_id=1284497424727442` |

EP-naam in elk bijschrift: **Deux Baguettes**.

## Browsertoetsen

Dit zijn Chrome- en bureaubladtoetsen. Het zijn geen Meta-sneltoetsen.

| Toets | Werking |
|---|---|
| `Ctrl+L`, dan de planner-URL, dan `Enter` | Opent de planner zonder de zijbalk aan te raken |
| `Alt+Left` | Terug naar de planner als een nieuwe tab op een loginpagina uitkomt |
| `Escape` | Sluit een open menu of het dialoogvenster **Reschedule post** |
| `Tab` | Gaat naar het volgende veld **nadat** de cursor al in het dialoogvenster staat |
| `Enter` | Activeert de knop die focus heeft |
| `Ctrl+A` | Selecteert de tekst van het veld waarin de cursor knippert |
| `Ctrl+C` / `Ctrl+V` | Kopieert of plakt in datzelfde veld |

`Ctrl+A` en `Ctrl+F` buiten een knipperende cursor raken de pagina of de adresbalk. In de sessie selecteerde `Ctrl+A` de hele pagina toen het tijdveld geen cursor had.

## Login

1. `Ctrl+L`, `https://business.facebook.com/`, `Enter`.
2. Staat de suite al open op marcsmusic_1, dan stoppen.
3. Anders alleen de knop **Continue with Instagram**.
4. Bij HTTP 429 één keer **Reload**.
5. Op het Instagram-formulier één keer in het gebruikersnaamveld klikken zodat de cursor knippert, en daar stoppen. Het wachtwoord typt de gebruiker zelf.

## Twee verschillende `...`-menu's

Het menu hangt af van waar het opent.

**Rij in de lijst Scheduled.** Gezien: **Manage post**, **Download**, **Copy post link**, **Copy reel ID**. Hier zaten geen **Reschedule post** en geen **Delete reel**.

**Post details, de `...` rechtsboven in het voorbeeld.** Gezien: **Edit reel**, **Reschedule post**, **Delete reel**. Verplaatsen en verwijderen lopen via dit menu.

**Reschedule post** opent een dialoog met alleen datum en tijd. Het bijschrift en de video blijven daar onaangeroerd. `Escape` sluit die dialoog.

Rechtermuisklik op de video toonde **Save video as…** en **Open video in new tab**. Die tweede optie opende een uitgelogde tab. De video blijft met rust; vervangen gaat via **Create reel**.

## Create reel

Eén reel afmaken voordat de volgende begint. De bevestigingsknop heet **Schedule**. **Share now** blijft dicht.

1. Planner openen met de URL hierboven. In de linkernavigatie **Content**, daarna **Scheduled**. Een aparte URL voor die lijst is niet vastgelegd.
2. **Create reel**.
3. **Add Video**. De bestandskiezer is het GTK-venster van het bureaublad, niet de webpagina.
4. In die kiezer `Ctrl+L`, het volledige pad typen, `Enter`:
   - Tourne les hanches: `/home/ubuntu/Downloads/tourne-reel.mp4`
   - C'était Écrit en Je t'attendrai: `/home/ubuntu/Downloads/cetait-ecrit-reel.mp4`
   - EP-posts (Pre-save, Nog 2 dagen, Morgen, OUT NOW): `/home/ubuntu/Downloads/deux-baguettes-reel.mp4`
5. Wachten tot het voorbeeld de hele cover toont, met wit boven en onder. Daarna pas verder.
6. In het bijschriftveld klikken tot de cursor knippert. Dan `Ctrl+V`. Alleen de datumregel wijzigen: `9 oktober` wordt `23 oktober`. **Deux Baguettes** blijft letterlijk zo staan. Een hashtag-lijst sluiten met `Escape`.
7. **Next**. Op de bewerkingspagina niets croppen; de mp4 is al passend.
8. Op het Share-scherm het tabblad **Schedule** (naast **Share now** en **Save as draft**).

## Datum en tijd

De datumkiezer nam `10/17/2026` aan en sloot daarna. Het tijdveld is een tekstveld zodra de cursor erin knippert. Zolang die cursor er niet is, veert de tijd terug naar `10:00 AM` of `10:16 AM`. Het klokicoon opende in deze sessie geen kiezer.

Tijd zetten:

1. Eén keer in het tijdveld, tot de cursor knippert.
2. `Ctrl+A`.
3. De tijd typen zoals het veld hem al toont: `10:00 AM`, `5:00 PM` of `8:00 AM`.
4. `Tab`, zodat het veld de waarde vastlegt.
5. Pas daarna de blauwe knop **Schedule**.

Blijft de oude tijd staan, dan toch **Schedule** op de tijd die er staat. Daarna de nieuwe rij openen, `...` in **Post details**, **Reschedule post**, en daar dezelfde toetsvolgorde: cursor, `Ctrl+A`, tijd, `Tab`.

## Verwijderen

De oude rij gaat weg nadat de nieuwe rij in **Scheduled** zichtbaar is.

1. De oude rij openen zodat **Post details** rechts staat.
2. `...` in dat paneel.
3. **Delete reel**.
4. De bevestiging **Delete**.

De `...` op de lijstrij zelf heeft die verwijderactie niet.

## Plannerregels voor Deux Baguettes

Wi De-rijen blijven staan.

| Oud | Nieuw | Bestand | Eerste regel |
|---|---|---|---|
| ma 5 okt 10:00 | vr 16 okt 2026 10:00 AM | `tourne-reel.mp4` | 15 seconden Tourne les hanches |
| ma 5 okt 17:00 | za 17 okt 2026 5:00 PM | `tourne-reel.mp4` | Tourne les hanches À gauche |
| di 6 okt 10:00 | zo 18 okt 2026 10:00 AM | `cetait-ecrit-reel.mp4` | 15 seconden C'était Écrit |
| di 6 okt 17:00 | ma 19 okt 2026 5:00 PM | `cetait-ecrit-reel.mp4` | Je t'attendrai |
| wo 7 okt 10:00 | di 20 okt 2026 10:00 AM | `deux-baguettes-reel.mp4` | Pre-save is live |
| wo 7 okt 17:00 | wo 21 okt 2026 5:00 PM | `deux-baguettes-reel.mp4` | Nog 2 dagen |
| do 8 okt 17:00 | do 22 okt 2026 5:00 PM | `deux-baguettes-reel.mp4` | Morgen is het zover |
| vr 9 okt 08:00 | vr 23 okt 2026 8:00 AM | `deux-baguettes-reel.mp4` | OUT NOW |

In het bijschrift van **Nog 2 dagen** wordt `Vrijdag 9` vervangen door `vrijdag 23 oktober`.
