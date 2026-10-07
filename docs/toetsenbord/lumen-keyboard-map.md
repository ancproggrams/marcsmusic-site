# LUNA keyboard map

Verified application: **Universal Audio LUNA 3.0.0** (build 4563, `com.uaudio.luna`).
No application named Lumen is installed. This file is the Lumen-slot map for the DAW that is actually on this Mac.

Source of truth, re-read before use:

- Factory: `/Applications/LUNA.app/Contents/Resources/shortcuts/shortcuts.json` (set name `luna`, 182 commands)
- Custom set on disk: `~/Library/Application Support/Universal Audio/Custom Shortcuts/shortcuts.json` (set name `MasterDisaster`)

The custom set matches the factory set except two commands that were unassigned in the factory file:

| Command | Factory | MasterDisaster set |
|---|---|---|
| Nudge Left 1 Bar | unassigned | Ctrl+Opt+Left |
| Nudge Right 1 Bar | unassigned | Ctrl+Opt+Right |

Do not overwrite either JSON. If LUNA is updated, parse the JSON again. Do not invent shortcuts from older UA help pages when they are absent here.

## System conflict

macOS Spotlight symbolic hotkey 64 is enabled for **Cmd+Space**. That steals both of these installed bindings:

- LUNA Toggle Record (`Cmd+Space`)
- FL Studio Start/Pause (`Cmd+Space`)

Use **Space** for play/stop. Do not send Cmd+Space. LUNA has no second record shortcut in this build. Arm recording from the Record control unless the user has changed the Spotlight shortcut.

## Production keys

| Task | Keys |
|---|---|
| Play / stop | Space |
| Stop mode (playhead stays) | Shift+Space |
| Return to zero | Return |
| Restart playback | Ctrl+Opt+Cmd+Space |
| Loop playback | Ctrl+L |
| Loop selection | Shift+Cmd+L |
| Update loop | Cmd+L |
| Metronome | K |
| Count-in | Shift+K |
| Pre/post-roll | Cmd+K |
| Timeline / Mixer | Cmd+= |
| Show Timeline | Cmd+F1 |
| Show Mixer | Cmd+F2 |
| Browser | `` ` `` (backtick) |
| Undo / Redo | Cmd+Z / Shift+Cmd+Z |
| Cut / Copy / Paste | Cmd+X / Cmd+C / Cmd+V |
| Duplicate selection | Cmd+D |
| Separate (split) | Cmd+E |
| Heal split | Cmd+H |
| Trim to selection | Cmd+T |
| Delete | Cmd+Backspace |
| Clear | Backspace |
| Nudge left / right | `,` / `.` (2× is `M` / `/`) |
| Zoom | Cmd+[ and Cmd+] |
| Frame selection | E |
| Snap | Shift+\\ |
| Markers: create | NumPad Enter |
| Next / previous marker | Ctrl+Opt+' / Ctrl+Opt+L |
| Next / previous transient | Tab / Opt+Tab |
| Track mute / solo / record | Shift+M / Shift+S / Shift+R |
| New instrument | Shift+Cmd+I |
| MIDI keyboard mode | Opt+Cmd+M |
| Quantize / settings | Cmd+U / Shift+Cmd+U |
| Tools 1–5 | Default, Pencil, Paint, Velocity, Erase |
| Semitone / octave | Up Down / Shift+Up Shift+Down |
| Select all | Cmd+A |
| Settings | Cmd+, |

Transpose shortcuts apply to selected MIDI notes. The Velocity tool is the number key 4, not a velocity increment command. There is no host command in this build for humanize, note-length trim by a musical value, or plugin-window focus.

Single-key tools (1–5, A, D, E, G, S, Space, K) only work when the timeline has focus and MIDI Keyboard Mode is off.

## Every factory command

| Command | Factory keys | MasterDisaster change |
|---|---|---|
| Abort Recording | Shift+Cmd+. | — |
| Align Bar | Opt+Shift+Cmd+I | — |
| Align Grid | Opt+Cmd+I | — |
| Auto-Scroll | Shift+A | — |
| Bounce | Cmd+B | — |
| Bounce Range | Opt+B | — |
| Bounce Settings | Opt+Shift+B | — |
| Browse All Recent | Opt+Cmd+O | — |
| Clear | Backspace | — |
| Close | Cmd+W | — |
| Close Session | Shift+Cmd+W | — |
| Consolidate Selection | Opt+Shift+3 | — |
| Consolidate Signal | Ctrl+Opt+Shift+3 | — |
| Copy | Cmd+C | — |
| Create Bus | Shift+Cmd+B | — |
| Create Fades | Cmd+F | — |
| Create Folder from Selection | Shift+Cmd+D | — |
| Create Marker | NumPad Enter | — |
| Cut | Cmd+X | — |
| Decrease All Track Heights | Ctrl+Opt+Down | — |
| Decrease Grid | Shift+- | — |
| Decrease Selected Track Heights | Ctrl+Down | — |
| Decrement Nudge Value | Opt+Cmd+- | — |
| Default Tool | 1 | — |
| Delete | Cmd+Backspace | — |
| Delete Selected Tracks | Shift+Cmd+Backspace | — |
| Duplicate | Opt+D | — |
| Duplicate Selection | Cmd+D | — |
| Duplicate Version For All Tracks | Ctrl+Opt+Cmd+\ | — |
| Duplicate Version For Selected Tracks | Ctrl+Cmd+\ | — |
| Duplicate Without Content | Opt+Shift+D | — |
| Erase Tool | 5 | — |
| Export Clips | Shift+Cmd+K | — |
| Export Mixdown | Opt+Cmd+B | — |
| Extend Down | Shift+; | — |
| Extend Scroll To Left Selection | Shift+Left | — |
| Extend Scroll To Right Selection | Shift+Right | — |
| Extend To Next Bar | Shift+] | — |
| Extend To Next Clip Edge | Shift+' | — |
| Extend To Next Marker | Ctrl+Opt+Shift+' | — |
| Extend To Next Transient | Shift+Tab | — |
| Extend To Previous Bar | Shift+[ | — |
| Extend To Previous Clip Edge | Shift+L | — |
| Extend To Previous Marker | Ctrl+Opt+Shift+L | — |
| Extend To Previous Transient | Opt+Shift+Tab | — |
| Extend To Session End | Opt+Shift+Return | — |
| Extend To Session Start | Shift+Return | — |
| Extend Up | Shift+P | — |
| Fade To Clip Start | D | — |
| Fade To Clip Stop | G | — |
| Find Track | Opt+Cmd+F | — |
| Frame Entire Session | Ctrl+Opt+Cmd+Down | — |
| Frame Selection | E | — |
| Heal Separation | Cmd+H | — |
| Import Session Data | Opt+I | — |
| Import... | Cmd+I | — |
| Increase All Track Heights | Ctrl+Opt+Up | — |
| Increase Grid | Shift+= | — |
| Increase Selected Track Heights | Ctrl+Up | — |
| Increment Nudge Value | Opt+Cmd+= | — |
| Loop Playback | Ctrl+L | — |
| Loop Select | Shift+Cmd+L | — |
| Manage Extensions | Opt+Cmd+L | — |
| MIDI Keyboard Mode | Opt+Cmd+M | — |
| Mixer Bank Left | Cmd+Left | — |
| Mixer Bank Right | Cmd+Right | — |
| Mixer Far Left | Opt+Cmd+Left | — |
| Mixer Far Right | Opt+Cmd+Right | — |
| Mixer Scroll Left | Left | — |
| Mixer Scroll Righ | Right | — |
| Move Down | ; | — |
| Move To Next Bar | ] | — |
| Move To Next Clip Edge | ' | — |
| Move To Next Marker | Ctrl+Opt+' | — |
| Move To Next Transient | Tab | — |
| Move To Previous Bar | [ | — |
| Move To Previous Clip Edge | L | — |
| Move To Previous Marker | Ctrl+Opt+L | — |
| Move To Previous Transient | Opt+Tab | — |
| Move Up | P | — |
| Mute Selection | Cmd+M | — |
| Navigate All Lane Views Left | Ctrl+Opt+Cmd+Left | — |
| Navigate All Lane Views Right | Ctrl+Opt+Cmd+Right | — |
| Navigate Selected Lane Views Left | Ctrl+Cmd+Left | — |
| Navigate Selected Lane Views Right | Ctrl+Cmd+Right | — |
| New Instrument | Shift+Cmd+I | — |
| New Session | Cmd+N | — |
| New Track From Preset | Shift+Cmd+P | — |
| New Track Group | Cmd+G | — |
| New Tracks | Shift+Cmd+N | — |
| New Version | Shift+Cmd+S | — |
| New Version For All Tracks | Ctrl+Opt+\ | — |
| New Version For Selected Tracks | Ctrl+\ | — |
| New Window | Shift+Cmd+= | — |
| Next Tab | Opt+` | — |
| Next Version | Shift+Up | — |
| Next Window | Cmd+` | — |
| Nudge Content Left | Ctrl+, | — |
| Nudge Content Left 2X | Ctrl+M | — |
| Nudge Content Right | Ctrl+. | — |
| Nudge Content Right 2X | Ctrl+/ | — |
| Nudge Left | , | — |
| Nudge Left 1 Bar | (unassigned) | Ctrl+Opt+Left |
| Nudge Left 2X | M | — |
| Nudge Right | . | — |
| Nudge Right 1 Bar | (unassigned) | Ctrl+Opt+Right |
| Nudge Right 2X | / | — |
| Nudge To Next Clip | Ctrl+Opt+. | — |
| Nudge To Prev Clip | Ctrl+Opt+, | — |
| Open Session | Cmd+O | — |
| Open Version | Shift+Cmd+O | — |
| Paint Tool | 3 | — |
| Paste | Cmd+V | — |
| Pencil Tool | 2 | — |
| Previous Tab | Opt+Shift+` | — |
| Previous Version | Shift+Down | — |
| Previous Window | Shift+Cmd+` | — |
| Quantize | Cmd+U | — |
| Quantize Settings | Shift+Cmd+U | — |
| Quit | Cmd+Q | — |
| Redo | Shift+Cmd+Z | — |
| Reset Audio Zoom | Ctrl+Opt+Cmd+[ | — |
| Restart Playback | Ctrl+Opt+Cmd+Space | — |
| Return To Zero | Return | — |
| Reverse Selection | Ctrl+Shift+R | — |
| Save Bookmark... | Cmd+S | — |
| Save Track As Preset | Opt+Shift+P | — |
| Scroll To Selection Start | Left | — |
| Scroll To Selection Stop | Right | — |
| Select All | Cmd+A | — |
| Select All Tracks | Shift+Cmd+A | — |
| Selection Grouping | Ctrl+G | — |
| Separate Selection | Cmd+E | — |
| Set Selection Start | Down | — |
| Set Selection Stop | Up | — |
| Shift Clear | Shift+Backspace | — |
| Shift Cut | Shift+X | — |
| Shift Duplicate | Shift+D | — |
| Shift Insert Time | Shift+I | — |
| Shift Nudge Left | Shift+, | — |
| Shift Nudge Right | Shift+. | — |
| Shift PASTE | Shift+V | — |
| Show Mixer | Cmd+f2 | — |
| Show Settings | Cmd+, | — |
| Show Timeline | Cmd+f1 | — |
| Show/Hide Browser | ` | — |
| Show/Hide Floating Windows | Shift+W | — |
| Strip Silence... | Shift+Cmd+X | — |
| Suspend Groups | Shift+Cmd+G | — |
| Toggle All Lane Views | Opt+- | — |
| Toggle Count-In Enabled | Shift+K | — |
| Toggle Full Screen | Shift+Cmd+F | — |
| Toggle Input Monitor for Record Tracks | Opt+K | — |
| Toggle Metronome | K | — |
| Toggle Playback | Space | — |
| Toggle Pre/Post-Roll | Cmd+K | — |
| Toggle Record | Cmd+Space | — |
| Toggle Relative Grid Snap | Shift+Cmd+\ | — |
| Toggle Selected Lane Views | - | — |
| Toggle Snap To Grid | Shift+\ | — |
| Toggle Stop Mode | Shift+Space | — |
| Toggle Timeline/Mixer | Cmd+= | — |
| Toggle Track Input Monitoring | Shift+T | — |
| Toggle Track Mute | Shift+M | — |
| Toggle Track Record Enable | Shift+R | — |
| Toggle Track Solo | Shift+S | — |
| Transpose Octave Down | Shift+Down | — |
| Transpose Octave Up | Shift+Up | — |
| Transpose Semitone Down | Down | — |
| Transpose Semitone Up | Up | — |
| Trim Clip To Selection | Cmd+T | — |
| Trim Control Value | Opt+Cmd+/ | — |
| Trim From Clip End | S | — |
| Trim From Clip Start | A | — |
| Undo | Cmd+Z | — |
| Update Loop | Cmd+L | — |
| Velocity Tool | 4 | — |
| Write Control Value | Cmd+/ | — |
| Zoom In | Cmd+] | — |
| Zoom In Audio | Opt+Cmd+] | — |
| Zoom Out | Cmd+[ | — |
| Zoom Out Audio | Opt+Cmd+[ | — |

Official menu reference (older than build 4563, use only to explain a command that is also in the JSON): https://help.uaudio.com/hc/en-us/articles/360041651392-Default-LUNA-Keyboard-Shortcuts-and-Menu-Reference-macOS
