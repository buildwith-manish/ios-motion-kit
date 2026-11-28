#!/usr/bin/env python3
"""
sfx_key.py - the one musical key every tonal part of the kit's SFX and music bed is tuned to.

KEY: C major pentatonic (C D E G A), equal temperament, A4 = 440 Hz. Import from here instead of typing frequencies.

    from sfx_key import note_freq, snap_to_scale, scale_notes
    note_freq("G5")            # 783.99 Hz
    snap_to_scale(2900.0)      # 3135.96 Hz (G7: the nearest scale note, measured in cents)
    scale_notes("C6", 12)      # ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7', 'A7', 'C8', 'D8']

Run `python3 scripts/sfx_key.py` to print the scale over the registers the kit uses.
"""
import math
import re

KEY_NAME = "C major pentatonic"
TONIC = "C"
A4_HZ = 440.0
A4_MIDI = 69
NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
SCALE_PITCH_CLASSES = (0, 2, 4, 7, 9)  # C D E G A

_NAME_RE = re.compile(r"^([A-G])(#?)(-?\d+)$")


def note_to_midi(name: str) -> int:
    """'C4' -> 60, 'A4' -> 69. Sharps only ('F#3')."""
    m = _NAME_RE.match(name)
    if not m:
        raise ValueError(f"bad note name {name!r}")
    pc = NOTE_NAMES.index(m.group(1) + m.group(2))
    return 12 * (int(m.group(3)) + 1) + pc


def midi_to_name(midi: int) -> str:
    return f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


def midi_to_freq(midi: float) -> float:
    return A4_HZ * 2.0 ** ((midi - A4_MIDI) / 12.0)


def note_freq(name: str) -> float:
    """Frequency (Hz) of a note name, equal temperament, A4 = 440."""
    return midi_to_freq(note_to_midi(name))


def freq_to_midi_float(freq: float) -> float:
    return A4_MIDI + 12.0 * math.log2(freq / A4_HZ)


def in_scale(midi: int) -> bool:
    return midi % 12 in SCALE_PITCH_CLASSES


def snap_midi(freq: float) -> int:
    """MIDI number of the scale note nearest to `freq` (distance measured in cents, i.e. on the log axis)."""
    m = freq_to_midi_float(freq)
    base = int(math.floor(m))
    candidates = [c for c in range(base - 3, base + 5) if in_scale(c)]
    return min(candidates, key=lambda c: (abs(c - m), c))


def snap_to_scale(freq: float) -> float:
    """Frequency of the scale note nearest to `freq`."""
    return midi_to_freq(snap_midi(freq))


def cents_between(freq: float, ref: float) -> float:
    """Signed distance of `freq` from `ref` in cents (+ = sharp)."""
    return 1200.0 * math.log2(freq / ref)


def cents_from_scale(freq: float) -> tuple:
    """(nearest scale note name, signed cents from it)."""
    m = snap_midi(freq)
    return midi_to_name(m), cents_between(freq, midi_to_freq(m))


def scale_notes(start: str, count: int) -> list:
    """`count` consecutive scale notes upward, beginning at `start` (which must itself be a scale note)."""
    m = note_to_midi(start)
    if not in_scale(m):
        raise ValueError(f"{start} is not in {KEY_NAME}")
    out = []
    while len(out) < count:
        if in_scale(m):
            out.append(midi_to_name(m))
        m += 1
    return out


if __name__ == "__main__":
    print(f"{KEY_NAME}: pitch classes {[NOTE_NAMES[p] for p in SCALE_PITCH_CLASSES]}, A4 = {A4_HZ:g} Hz")
    for start in ("C1", "C3", "C5", "C6"):
        print(f"{start:>3}: " + "  ".join(f"{n}={note_freq(n):.2f}" for n in scale_notes(start, 5)))
