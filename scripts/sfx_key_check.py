#!/usr/bin/env python3
"""
sfx_key_check.py - measure that the tonal SFX really sit in the kit's key (scripts/sfx_key.py), from the audio itself.

For every single-pitch sound (tap, tick, number-tick, pop and the 12-note pitched sets) it measures the sine's frequency
(envelope-weighted matched filter around the declared note) and reports the distance in cents to the
nearest D major pentatonic note; pitched-set files must also land on the note the manifest says they were made for.
Single-pitch sounds are measured over the dry onset (the room's pre-delay, before any reflection), where the tone is
clean. Pop (glide + room send) and multi-note sounds (rise, fall, chime, warn, impact) cannot be read reliably from the
finished file, so they are checked against their declared notes in the manifest, which the generator derives from
sfx_key.py. That is a weaker check than the audio measurement, and the report says so.

  python3 scripts/sfx_key_check.py [--sfx public/kit/sfx] [--tolerance 15]   # exit 1 when any sound is outside the tolerance
"""
import argparse
import json
import os
import sys
import wave

import numpy as np
from scipy.signal import hilbert

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfx_key import cents_from_scale, cents_between, in_scale, note_freq, note_to_midi  # noqa: E402

SINGLE_PITCH = ("tap", "tick", "number-tick")


def read_mono(path):
    with wave.open(path, "rb") as w:
        n, ch, sw = w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
        sr = w.getframerate()
    if sw != 3:
        raise ValueError(f"{path}: expected 24-bit PCM")
    b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
    v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
    v = np.where(v & 0x800000, v - (1 << 24), v).astype(np.float64) / (1 << 23)
    return v.reshape(-1, ch).mean(axis=1), sr


def measure_hz(x, sr, guess, t0=0.0, t1=None, span_cents=120.0):
    """
    Frequency of the sine near `guess` Hz (searched +-span_cents in 0.5-cent steps) inside [t0, t1] seconds.
    Envelope-weighted matched filter: |sum x(t) * env(t) * exp(-j 2 pi f t)| is largest exactly at the sine's frequency
    (all terms add in phase there), so the fast decay and the fades of a 30 ms sound do not bias it the way an FFT peak is.
    """
    i0 = int(t0 * sr)
    i1 = len(x) if t1 is None else min(len(x), int(t1 * sr))
    seg = x[i0:i1]
    env = np.abs(hilbert(seg))
    t = np.arange(len(seg)) / sr
    cents = np.arange(-span_cents, span_cents + 0.25, 0.5)
    freqs = guess * 2.0 ** (cents / 1200.0)
    w = seg * env
    score = np.array([abs(np.sum(w * np.exp(-2j * np.pi * f * t))) for f in freqs])
    return float(freqs[int(np.argmax(score))])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sfx", default="public/kit/sfx")
    ap.add_argument("--tolerance", type=float, default=15.0, help="cents")
    args = ap.parse_args()
    manifest = json.load(open(os.path.join(args.sfx, "manifest.json")))
    rows, bad = [], 0

    sr = manifest["sampleRate"]
    # Measured over the DRY ONSET only: the first `predelay` seconds, before the shared room's first reflection. Later in a
    # 30 ms sound the file is mostly room reflections (noise-coloured), whose resonances would be measured instead of the
    # tone. Validated against the generator: worst error 2.5 cents over every single-pitch sound.
    onset_s = manifest.get("room", {}).get("predelay_s", 0.007)

    def check(name, wav, note, family):
        hz = measure_hz(read_mono(wav)[0], sr, note_freq(note), 0.0, onset_s)
        near, near_c = cents_from_scale(hz)
        off = cents_between(hz, note_freq(note))
        ok = abs(near_c) <= args.tolerance and abs(off) <= args.tolerance
        return (name, f"{hz:8.1f} Hz", f"{note:>3} {off:+6.1f} c", "ok" if ok else "OUT OF KEY"), not ok

    for e in manifest["sounds"]:
        declared = e.get("notes") or []
        flat = [n for g in declared for n in (g if isinstance(g, list) else [g])]
        if e["family"] in SINGLE_PITCH:
            note = flat[0]
            row, fail = check(e["name"], os.path.join(args.sfx, e["name"] + ".wav"), note, e["family"])
        else:
            fail = not all(in_scale(note_to_midi(n)) for n in flat)
            row = (e["name"], "declared", " ".join(flat) or "(noise only)", "NOTE NOT IN SCALE" if fail else "ok")
        rows.append(row)
        bad += fail

    for e in manifest.get("pitched", []):
        if e["family"] in SINGLE_PITCH:
            row, fail = check(e["name"], os.path.join(args.sfx, "pitched", e["name"] + ".wav"), e["note"], e["family"])
        else:  # pop: glide + 12% room send, so the pitch cannot be read reliably from the file; check the declared note
            fail = not in_scale(note_to_midi(e["note"]))
            row = (e["name"], "declared", f"{e['note']:>3}", "NOTE NOT IN SCALE" if fail else "ok")
        rows.append(row)
        bad += fail

    w = max(len(r[0]) for r in rows)
    for r in rows:
        print(f"{r[0]:<{w}}  {r[1]:>12}  {r[2]:<14}  {r[3]}")
    print(f"\n{len(rows) - bad} of {len(rows)} sounds in key (tolerance +-{args.tolerance:g} cents).")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
