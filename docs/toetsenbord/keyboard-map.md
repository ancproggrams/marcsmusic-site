# Keyboard map

Verified on 2026-09-29 for this Mac. Re-read the source if the app version changes. Do not invent a shortcut that is not on this page or in [lumen-keyboard-map.md](lumen-keyboard-map.md).

Together those two files are the verified DAW set. Meta Business Suite is not in that set: [meta-business-suite-toetsenbord.md](meta-business-suite-toetsenbord.md).

- FL Studio 26.1.0.5294, from the Image-Line manual page Keyboard & Mouse Shortcuts: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/basics_shortcuts.htm
- LUNA 3.0.0 build 4563, all 182 factory commands plus the two custom nudge bindings, in [lumen-keyboard-map.md](lumen-keyboard-map.md)

The manual prints Windows and macOS together as Ctrl/Cmd and Alt/Opt. On this Mac, use Command and Option. Mouse-only actions from that page are omitted here.

## Conflicts and modes

- Spotlight owns Cmd+Space (symbolic hotkey 64, enabled). Do not use it for FL Studio pause or LUNA record.
- FL Studio single-key shortcuts work only when Typing keyboard to piano is off. Toggle: Cmd+T.
- LUNA single-key tools work only when MIDI Keyboard Mode is off. Toggle: Opt+Cmd+M.
- FL Studio ships Novation scripts in `~/Documents/Image-Line/FL Studio/Settings/Hardware`. That folder is not evidence a keyboard is plugged in.

## Transport

| Action | Keys |
|---|---|
| Play / stop | Space |
| Play / pause | Cmd+Space, stolen by Spotlight. Do not use |
| Record on / off | R |
| Pattern / song | L |
| Fast forward | NumPad 0 |
| Next bar / previous bar (song) | NumPad * / NumPad / |
| Metronome | Cmd+M |
| Count-in | Cmd+P |
| Wait for input | Cmd+I |
| Panic | Cmd+H |
| Blend notes | Cmd+B |
| Step edit | Cmd+E |
| Line / none snap | Backspace |
| Typing keyboard to piano | Cmd+T. Leave this off while editing |

## Windows

| Action | Keys |
|---|---|
| Playlist | F5 |
| Channel rack | F6 |
| Piano roll | F7 |
| Plugin picker | F8 |
| Mixer | F9 |
| MIDI settings | F10 |
| Song info | F11 |
| Close all | F12 |
| Help | F1 |
| Sample browser | Opt+F8 |
| Tool selector | F3 |
| Cycle nested windows | Tab |
| Maximize / minimize playlist | Enter |
| Close window | Esc |
| Arrange windows | Cmd+Shift+H |

## File

| Action | Keys |
|---|---|
| New version | Cmd+N |
| Open | Cmd+O |
| Save | Cmd+S |
| Save as | Cmd+Shift+S |
| Export WAV | Cmd+R |
| Export MP3 | Cmd+Shift+R |
| Export MIDI | Cmd+Shift+M |
| Recent file | Opt+0 through Opt+9 |
| Undo / redo last | Cmd+Z |
| Undo step by step | Cmd+Opt+Z |

## Editing, playlist and piano roll

Shared editing keys:

| Action | Keys |
|---|---|
| Select all | Cmd+A |
| Deselect | Cmd+D |
| Cut / copy / paste | Cmd+X / Cmd+C / Cmd+V |
| Duplicate to the right | Cmd+B |
| Delete | Delete, or Fn+Delete |
| Invert selection | Shift+I |
| Quantize | Opt+Q in the piano roll. Shift+Q quick-quantizes clip starts in the playlist |
| Group / ungroup | Shift+G / Opt+G |
| Add / delete space of the selection | Cmd+Insert / Cmd+Delete. On this Mac, Insert is Fn+Return |
| Move selection left / right | Shift+Left / Shift+Right |
| Zoom out / in | Page Down / Page Up |
| Horizontal zoom presets | Shift+1 through Shift+3, Shift+4 shows all, Shift+5 zooms the selection |
| Bypass snap while held | Opt |
| Tools | B paint, C slice, D delete, E select, P pencil, T mute, Y playback, Z zoom. Playlist also uses S for slip |

Piano roll only:

| Action | Keys |
|---|---|
| Semitone transpose | Shift+Up / Shift+Down. The piano-roll menu names this as one semitone. The shortcuts page calls the same chord “move selection up/down” |
| Octave transpose | Cmd+Up / Cmd+Down |
| Nudge | Opt+arrow keys |
| Slide note (808 glide on supporting instruments) | S |
| Portamento | O |
| Legato | Cmd+L |
| Quick quantize | Cmd+Q |
| Quick chop | Cmd+U |
| Discard lengths | Shift+D |
| Glue | Cmd+G |
| Mute / unmute selection | Opt+M / Opt+Shift+M |
| Articulate / randomize / strum / chop / LFO / arpeggiator | Opt+L / Opt+R / Opt+S / Opt+U / Opt+O / Opt+A |
| Scale levels / score flipper / flam / claw / limit | Opt+X / Opt+Y / Opt+F / Opt+W / Opt+K |
| Import MIDI | Cmd+M in the piano roll. This is not the metronome. Metronome is Cmd+M when the piano roll is not the target. Focus matters |
| Channel above / below | G / K. H / J skip to channels that contain notes |
| Keyboard view | M |
| Ghost channels | Opt+V |
| Paste MIDI clipboard | Shift+Cmd+V |

Playlist markers: use Opt+T to add a time marker. The manual also lists Cmd+T for a playlist marker, but Cmd+T toggles typing-to-piano from the transport list. Prefer Opt+T so you do not flip that mode. Opt+/ and Opt+* jump between markers. Consolidate selection from the first clip: Cmd+Opt+C. From the start of the playlist: Cmd+Opt+Shift+C.

## Channel rack

| Action | Keys |
|---|---|
| Select channel | Up / Down |
| Move channel | Shift+Up / Shift+Down, or Opt+Up / Opt+Down to reorder |
| Mute / solo first 10 | number keys / Cmd+number |
| Clone / delete | Opt+C / Opt+Delete |
| Group / zip / unzip | Opt+G / Opt+Z / Opt+U |
| Copy / cut / paste steps or score | Cmd+C / Cmd+X / Cmd+V |
| Route to a free mixer track | Cmd+L |
| Shift steps | Shift+Cmd+Left / Shift+Cmd+Right |
| Next pattern / previous | NumPad + / NumPad − |
| Next empty pattern | F4, or Cmd+F4 |

## Mixer

| Action | Keys |
|---|---|
| Solo | S |
| Alt solo (routed tracks) | Opt+S |
| Rename | F2 |
| Select all | Cmd+A |
| Move tracks | Opt+Left / Opt+Right |
| Link selected channels | Cmd+L |
| Link starting from this track | Shift+Cmd+L |
| Route selected channels to free tracks | Cmd+L from the channel rack |
| Render armed tracks | Opt+R |
| Save mixer state | Cmd+Shift+S while the mixer has focus. Same chord as Save As elsewhere. Focus matters |
| Peak meter waveform | Opt+W |
| Select channels linked to this track | Opt+L |

## Browser and patterns

Enter replaces the selected channel with the browser item. Shift+Up / Shift+Down previews. NumPad 1–9 selects patterns. F2 renames the pattern.

## LUNA

Use [lumen-keyboard-map.md](lumen-keyboard-map.md) for every LUNA command. Space is play/stop there too. Record is Cmd+Space and is stolen by Spotlight.
