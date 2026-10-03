# LUNA and controller MIDI map

Verified 2026-09-29. There is no installed application named Lumen. This map is for Universal Audio LUNA 3.0.0 (build 4563) and for a controller that was not connected.

## What LUNA can do

- MIDI instruments can be played from a keyboard. New instrument track: Shift+Cmd+I
- Typing-keyboard MIDI: Opt+Cmd+M (MIDI Keyboard Mode). Turn it off before using single-key edit commands
- Quantize: Cmd+U. Quantize settings: Shift+Cmd+U
- Selected notes: Up/Down semitone, Shift+Up/Down octave, tool 4 is the velocity tool, tool 2 is the pencil

LUNA’s installed shortcut file contains no MIDI-learn command. On 16 June 2026 a Universal Audio staff reply on the Universal Audio forum stated that LUNA does not currently have MIDI mapping. Re-check that in the version you have open before you tell the user it is impossible, and do not build a fake host map.

Waves documents a Mac-only workaround for specific Waves plugins: an empty instrument track sends its MIDI output to the audio track that holds the plugin, and that plugin’s own Learn function is used. That is not a general LUNA feature. Use it only for a plugin on Waves’ supported list.

Plugin MIDI learn, where the plugin itself shows it, is stored by the plugin or the project. Surge XT is installed and is the first place to look for a synth that can learn CC. Save the preset after learning. Do not assume every installed UA plugin will learn.

## No controller was connected

USB and Bluetooth device lists showed no MIDI keyboard, pads, or control surface. The Bluetooth device with firmware `MPK10.00_0010` is a Logitech ERGO K860 typing keyboard. Do not map pads onto it.

Factory Novation FLKEY scripts live inside FL Studio’s settings. They are scripts, not a detected device.

## When a controller appears

1. Read the port name from Audio MIDI Setup or from FL Studio MIDI settings (F10). Record manufacturer, model, key count, knobs, faders, pads, transport, pitch bend, modulation, aftertouch, and whether a sustain pedal sends CC64.
2. Export or duplicate any existing FL Studio controller definition and any plugin preset that already contains learned CC. The Novation scripts under `~/Documents/Image-Line/FL Studio/Settings/Hardware` stay untouched.
3. Apply the layout below only to controls that exist and are not already doing something useful. Skip a row rather than stealing a mapping the user relies on.
4. Persist in the place the host actually saves: FL Studio project or controller type, or the plugin preset. LUNA has nowhere to store a host CC map until a version with MIDI mapping is installed. After mapping, twist every assigned control once and confirm the parameter moves.
5. Write the resulting map under the song’s `04_midi/controller-map.md` so the next session does not rediscover it by overwriting it.

## Layout to apply

| Control | Assignment |
|---|---|
| Knob 1 | Filter cutoff |
| Knob 2 | Resonance |
| Knob 3 | Attack |
| Knob 4 | Release |
| Knob 5 | Drive |
| Knob 6 | FX send or mix |
| Knob 7 | Macro 1 |
| Knob 8 | Macro 2 |
| Pads | Drums, triggers, or markers. One pad, one job |
| Mod wheel | Expression or vibrato depth, CC1, matching the instrument |
| Pitch bend | The instrument’s pitch-bend range. Set the range in the synth before performing glides |
| Sustain pedal | CC64. At or above 64 is down. At or below 63 is up |

Bass and 808 glides use the bend range documented in the music-production skill, `references/bass.md`. A mod wheel mapped to filter is a different performance than a mod wheel mapped to vibrato. Pick one per instrument and write it down.

Transport buttons on a controller are preferable to Cmd+Space, because Spotlight will eat Cmd+Space. If the controller has its own play button, learn that in FL Studio only, and leave LUNA’s record command alone until Spotlight is changed by the user.
