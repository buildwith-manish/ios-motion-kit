#!/usr/bin/env python3
"""
kit_make_music.py - minimal ambient pad bed for the reusable kit. Original, additive synthesis, no samples.

Writes public/kit/music/pad-loop.wav (48 kHz, 16-bit stereo, 64 s) + public/kit/music/manifest.json.

Seamless by construction, not by crossfade: every partial's frequency is an integer number of cycles per loop (k / T),
every LFO has an integer number of cycles per loop, the noise bed is built with an inverse FFT of exactly one loop, and
the final tone shaping is a circular (FFT) filter. The last sample therefore flows into the first one exactly.

Character: one static open chord (no melody, no rhythm), slowly beating detuned voices, "filter movement" done as slowly
moving harmonic brightness per voice, plus a faint airy noise whose colour drifts. Low level (about -28 LUFS).

Usage: python3 scripts/kit_make_music.py [--out public/kit/music] [--seconds 64]
"""
import argparse
import json
import os
import wave

import numpy as np

SR = 48000
TARGET_LUFS = -28.0


def k_weight(x):
    from scipy import signal

    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x))


def lufs(stereo):
    ms = sum(np.mean(k_weight(stereo[:, c]) ** 2) for c in range(stereo.shape[1]))
    return -0.691 + 10 * np.log10(max(ms, 1e-12))


def build(T):
    N = int(T * SR)
    t = np.arange(N, dtype=np.float64) / SR
    rng = np.random.default_rng(20261127)
    grid = 1.0 / T

    def q(f):  # snap to a whole number of cycles per loop
        return max(1, round(f / grid)) * grid

    # Open D chord (D2 A2 D3 F#3 A3 E4): static, so there is no melody. (freq Hz, level, brightness cycles/loop, phase)
    voices = [
        (73.42, 1.00, 1, 0.0),
        (110.00, 0.80, 2, 1.1),
        (146.83, 0.70, 1, 2.3),
        (185.00, 0.50, 3, 0.7),
        (220.00, 0.50, 2, 4.0),
        (329.63, 0.30, 1, 5.2),
    ]
    # detune per side, in whole cycles per loop -> beating of ~0.05-0.2 Hz, still exactly periodic
    detune_cycles = [3, 5, 4, 7, 6, 9]

    ctrl_hz = 200
    nc = int(T * ctrl_hz)
    tc = np.arange(nc, dtype=np.float64) / ctrl_hz
    out = np.zeros((N, 2), dtype=np.float64)
    for vi, (f, lvl, bc, ph) in enumerate(voices):
        bright = 0.12 + 0.88 * (0.5 + 0.5 * np.sin(2 * np.pi * bc * tc / T + ph))  # slow 'filter' sweep
        amp_lfo = 1.0 + 0.15 * np.sin(2 * np.pi * (bc + 1) * tc / T + ph * 1.7)
        for side, (sign, ch) in enumerate(((-1, 0), (+1, 1))):
            fq = q(f) + sign * detune_cycles[vi] * grid * 0.5
            fq = max(grid, round(fq / grid) * grid)
            for h in range(1, 7):
                if fq * h > 6000:
                    break
                env_c = lvl * amp_lfo * (bright ** (0.9 * (h - 1))) / (h**1.25)
                env = np.interp(t, tc, env_c)
                phase0 = rng.uniform(0, 2 * np.pi)
                out[:, ch] += env * np.sin(2 * np.pi * fq * h * t + phase0)
    out /= 6.0

    # periodic airy noise: irfft of one loop with random phases, two colours crossfaded by an integer-cycle LFO
    def periodic_noise(cutoff):
        spec_f = np.fft.rfftfreq(N, 1 / SR)
        mag = 1.0 / np.sqrt(np.maximum(spec_f, 20.0))
        mag *= 1.0 / (1.0 + (spec_f / cutoff) ** 4)
        mag[spec_f < 40] = 0
        spec = mag * np.exp(1j * rng.uniform(0, 2 * np.pi, len(spec_f)))
        x = np.fft.irfft(spec, N)
        return x / np.max(np.abs(x))

    xf = 0.5 + 0.5 * np.sin(2 * np.pi * 2 * t / T)
    for ch in range(2):
        n_lo = periodic_noise(500.0)
        n_hi = periodic_noise(2600.0)
        out[:, ch] += 0.022 * (n_lo * (1 - xf) + n_hi * xf) * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * t / T + ch))

    # circular tone shaping (zero-phase, keeps the loop seamless): high-pass 35 Hz, gentle roll-off above 5 kHz
    spec_f = np.fft.rfftfreq(N, 1 / SR)
    shape = (1 / (1 + (35.0 / np.maximum(spec_f, 1e-3)) ** 4)) * (1 / (1 + (spec_f / 5000.0) ** 2))
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(out[:, ch]) * shape, N)
    return out


def write_wav16(path, x):
    rng = np.random.default_rng(1)
    dither = (rng.random(x.shape) - rng.random(x.shape)) / 32768.0  # TPDF, +-1 LSB
    ints = np.round(np.clip(x + dither, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(ints.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/kit/music")
    ap.add_argument("--seconds", type=float, default=64.0)
    args = ap.parse_args()
    if not 60 <= args.seconds <= 90:
        ap.error("--seconds must be 60..90")
    os.makedirs(args.out, exist_ok=True)
    x = build(args.seconds)
    gain = 10 ** ((TARGET_LUFS - lufs(x)) / 20)
    x *= gain
    peak = float(np.max(np.abs(x)))
    path = os.path.join(args.out, "pad-loop.wav")
    write_wav16(path, x)

    # seam check: step across the loop point vs the typical sample-to-sample step
    step = np.abs(x[0] - x[-1]).max()
    typical = np.abs(np.diff(x, axis=0)).max()
    manifest = {
        "file": "kit/music/pad-loop.wav",
        "sampleRate": SR,
        "bitDepth": 16,
        "channels": 2,
        "loopSeconds": args.seconds,
        "lufs": round(float(lufs(x)), 2),
        "peakDb": round(20 * np.log10(peak), 2),
        "seamStep": float(step),
        "maxSampleStep": float(typical),
    }
    with open(os.path.join(args.out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
