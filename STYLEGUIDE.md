# MarcsMusic Styleguide

## Direction

MarcsMusic now uses a restrained listening-room identity: mostly black and white, with pastel blue reserved for playback state, selected rows, focus, frame accents and subtle backgrounds.

## Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--ink` | `#070707` | Primary text, main buttons, player shell |
| `--surface` | `#ffffff` | Panels, page sections, navigation surfaces |
| `--bg` | `#f7f9fb` | Page background |
| `--muted` | `#74777c` | Captions, secondary text |
| `--line` | `#d8e2ea` | Hairlines and quiet separators |
| `--pastel` | `#cfe8ff` | Playback accent, selected states, frame shadow |
| `--pastel-strong` | `#9ccdff` | Hover and stronger accent borders |
| `--pastel-muted` | `#eaf6ff` | Soft section wash and secondary hover |

## Typography

- Display: `Iowan Old Style`, `Charter`, Georgia, serif.
- Body: system sans stack.
- Mono: system monospace for labels, track numbers and time counters.
- Letter spacing stays at `0` for headings. Mono labels may use positive tracking.

## Components

- Buttons and panels use an `8px` radius.
- Primary actions are black with white text.
- Secondary actions are white with black borders.
- Player active state uses pastel blue.
- The Instagram photo frame uses a black border, white surface and pastel-blue offset shadow.

## Interaction Rules

- Keep the `Bookings` tab visible in the primary navigation.
- Keep native audio controls available for accessibility and fallback.
- Track rows must point to complete audio sources, not preview snippets.
- The Instagram frame remains a first-class section of the page.
