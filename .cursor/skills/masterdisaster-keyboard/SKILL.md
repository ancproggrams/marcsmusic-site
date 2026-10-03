---
name: masterdisaster-keyboard
description: >-
  Bedient Universal Audio LUNA 3 en FL Studio 26 op deze Mac met de
  geverifieerde MasterDisaster-toetsenbordkaarten. Gebruik bij LUNA, FL
  Studio, MIDI-controller, sneltoetsen, nudge, transport, piano roll, mixer
  of channel rack. Verzin geen sneltoets en stuur geen Cmd+Space.
---

# MasterDisaster-toetsenbord

Lees de kaart voordat je een toets stuurt. Een sneltoets die niet in de kaart staat, bestaat niet.

| Taak | Bestand |
|---|---|
| LUNA 3.0.0 build 4563, set `MasterDisaster` | `docs/toetsenbord/lumen-keyboard-map.md` |
| FL Studio 26.1.0.5294 | `docs/toetsenbord/keyboard-map.md` |
| Controller, knoppen, pads, wielen | `docs/toetsenbord/lumen-midi-map.md` |

Meta Business Suite is een andere skill: `meta-business-suite`. Stuur daar geen DAW-toetsen heen.

## Regels

- `Cmd+Space` is Spotlight. Die toets bereikt LUNA Record en FL Studio pause niet. Afspelen en stoppen is `Space`.
- FL Studio-lettertoetsen werken alleen als Typing keyboard to piano uit staat. Schakelaar: `Cmd+T`. Laat die uit tijdens bewerken.
- LUNA-lettertoetsen werken alleen als MIDI Keyboard Mode uit staat. Schakelaar: `Opt+Cmd+M`.
- De custom set `MasterDisaster` wijkt op twee plekken af van de fabrieksset: Nudge Left 1 Bar is `Ctrl+Opt+Left`, Nudge Right 1 Bar is `Ctrl+Opt+Right`. De rest is de fabriekslijst. Overschrijf `~/Library/Application Support/Universal Audio/Custom Shortcuts/shortcuts.json` niet.
- Bij een andere app-versie de geïnstalleerde shortcut-JSON opnieuw lezen. De kaart van 29 september 2026 is een momentopname.
- LUNA heeft in deze build geen host-MIDI-map. Geen CC-map verzinnen.
