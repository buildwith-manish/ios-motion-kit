#!/usr/bin/env python3
"""
kit_vo_envelope.py - voice-over loudness envelope for the kit's ducking (src/kit/audio/ducking.ts).

  python3 scripts/kit_vo_envelope.py voiceover.wav -o public/vo-envelope.json        # any file ffmpeg can read
  python3 scripts/kit_vo_envelope.py --demo                                         # write the fake demo VO + envelope

Output JSON ("kit-vo-envelope" v1):
  {"version": 1, "hz": 30, "startSeconds": 0, "durationSeconds": 10.0, "source": "...", "rms": [0.0, 0.031, ...]}
`rms` is the linear RMS (full scale = 1.0) of each consecutive 1/30 s window of the mono mix-down.

The same envelope drives (a) music/SFX ducking and (b) the "SFX never louder than the voice-over" ceiling.
numpy + scipy only; ffmpeg is used to decode non-WAV input.
"""
import argparse
import json
import os
import subprocess
import wave

import numpy as np
from scipy import signal

HZ = 30


def read_audio(path):
    """Returns (mono float32 array, sample rate). WAV (16/24/32-bit) is read directly, anything else via ffmpeg."""
    if path.lower().endswith(".wav"):
        try:
            with wave.open(path, "rb") as w:
                n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
                raw = w.readframes(n)
            if sw == 2:
                x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
            elif sw == 3:
                b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
                v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
                v = np.where(v & 0x800000, v - 0x1000000, v)
                x = v.astype(np.float32) / 8388608.0
            elif sw == 4:
                x = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
            else:
                raise ValueError("unsupported width")
            return x.reshape(-1, ch).mean(axis=1), sr
        except Exception:
            pass
    sr = 48000
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype="<f4"), sr


def envelope(x, sr, hz=HZ):
    """Linear RMS per 1/hz seconds (non-overlapping windows, last partial window included)."""
    win = sr / hz
    n = int(np.ceil(len(x) / win))
    out = np.zeros(n)
    for i in range(n):
        seg = x[int(round(i * win)) : int(round((i + 1) * win))]
        out[i] = np.sqrt(np.mean(seg.astype(np.float64) ** 2)) if len(seg) else 0.0
    return out


def write_envelope(path, rms, duration, source, hz=HZ):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(
            {"version": 1, "hz": hz, "startSeconds": 0, "durationSeconds": round(duration, 4), "source": source, "rms": [round(float(v), 5) for v in rms]},
            f,
        )
        f.write("\n")


# --------------------------------------------------------------------------------------------------- demo voice
DEMO_SEGMENTS = [(1.2, 3.6), (4.4, 6.2), (7.0, 9.0)]  # seconds of "speech" in the 10 s demo


def fake_voice(duration=10.0, sr=48000, segments=DEMO_SEGMENTS):
    """A deliberately fake, speech-like signal (harmonic buzz with syllable-rate amplitude + formant-ish lowpass)."""
    rng = np.random.default_rng(4242)
    n = int(duration * sr)
    t = np.arange(n) / sr
    f0 = 118 + 14 * np.sin(2 * np.pi * 0.7 * t)
    ph = 2 * np.pi * np.cumsum(f0) / sr
    buzz = sum(np.sin(k * ph) / k**0.9 for k in range(1, 20))
    gate = np.zeros(n)
    for a, b in segments:
        ia, ib = int(a * sr), int(b * sr)
        gate[ia:ib] = 1.0
    # syllables: random 3-6 Hz amplitude with small gaps between words
    syl = np.clip(0.55 + 0.45 * np.sin(2 * np.pi * (4.2 + 0.8 * np.sin(2 * np.pi * 0.31 * t)) * t + 1.3), 0, 1) ** 1.5
    word_gaps = (np.sin(2 * np.pi * 1.3 * t + 0.4) > -0.82).astype(float)
    sos = signal.butter(2, 3200, btype="low", fs=sr, output="sos")
    sm = signal.sosfilt(signal.butter(2, 40, btype="low", fs=sr, output="sos"), gate * word_gaps)
    x = signal.sosfilt(sos, buzz) * syl * sm
    x += 0.02 * signal.sosfilt(sos, rng.standard_normal(n)) * sm
    x *= 10 ** (-12 / 20) / np.max(np.abs(x))  # peak -12 dBFS, RMS around -24 while speaking
    return x.astype(np.float32), sr


def write_wav16(path, x, sr):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?")
    ap.add_argument("-o", "--out")
    ap.add_argument("--hz", type=int, default=HZ)
    ap.add_argument("--demo", action="store_true", help="write public/kit/demo/fake-vo.wav and src/kit/demo/fake-vo.envelope.json")
    args = ap.parse_args()
    if args.demo:
        x, sr = fake_voice()
        write_wav16("public/kit/demo/fake-vo.wav", x, sr)
        x, sr = read_audio("public/kit/demo/fake-vo.wav")  # measure the file as written (16-bit), same path as real use
        rms = envelope(x, sr)
        write_envelope("src/kit/demo/fake-vo.envelope.json", rms, len(x) / sr, "fake-vo.wav (synthetic, demo only)")
        print(f"demo: {len(x)/sr:.1f}s, {len(rms)} envelope samples, speaking RMS ~{20*np.log10(rms.max()):.1f} dBFS max")
        return
    if not args.input or not args.out:
        ap.error("input and -o/--out are required (or use --demo)")
    x, sr = read_audio(args.input)
    rms = envelope(x, sr, args.hz)
    write_envelope(args.out, rms, len(x) / sr, os.path.basename(args.input), args.hz)
    print(f"{args.input}: {len(x)/sr:.2f}s -> {len(rms)} samples @ {args.hz} Hz, max {20*np.log10(max(rms.max(),1e-9)):.1f} dBFS")


if __name__ == "__main__":
    main()
