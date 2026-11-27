#!/usr/bin/env python3
"""
kit_make_sfx.py - original, synthesized iOS-style UI sounds for the reusable kit (src/kit/audio).

Everything is generated from scratch with numpy + scipy: sines, FM bells and filtered noise. Nothing is sampled and
nothing is copied from scripts/make_sfx.py, foley/ or public/music.mp3. The sounds are *in the style of* soft, short,
clean system UI feedback; they are not reproductions of any real product sound.

Output (48 kHz, 24-bit WAV, 6 ms fade-in / 10 ms fade-out, peak normalised to -3 dBFS):
  public/kit/sfx/<family>-<1..3>.wav          mono, centre
  public/kit/sfx/<family>-<1..3>@L.wav|@R.wav stereo pre-panned (equal-power, +-0.75). Remotion's <Audio> has no pan
                                              prop, so the cue system picks these for panned cues. --no-pan skips them.
  public/kit/sfx/manifest.json                name, family, variant, duration, peak/RMS/LUFS estimate, peak time
  src/kit/audio/sfx-manifest.json             copy of the manifest for the TypeScript side

Usage:  python3 scripts/kit_make_sfx.py [--out public/kit/sfx] [--no-pan]
Deterministic: every sound is seeded from (family, variant).
"""
import argparse
import json
import os
import shutil
import struct
import wave
import zlib

import numpy as np
from scipy import signal

SR = 48000
PEAK_DB = -3.0
FADE_IN_MS = 6.0
FADE_OUT_MS = 10.0
PAN_POS = 0.75  # -1..1 position used for the pre-panned L/R files


# ----------------------------------------------------------------------------------------------------- utilities
def rng_for(family: str, variant: int) -> np.random.Generator:
    return np.random.default_rng(zlib.crc32(f"{family}:{variant}".encode()))


def tvec(dur: float) -> np.ndarray:
    return np.arange(int(round(dur * SR))) / SR


def exp_decay(t, tau):
    return np.exp(-t / tau)


def attack(t, a):
    """Smooth (raised-cosine) attack of `a` seconds."""
    x = np.clip(t / max(a, 1e-6), 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * x)


def sine_sweep(t, f0, f1, curve="exp"):
    """Phase-accumulated sine gliding f0 -> f1 across the whole vector."""
    n = len(t)
    x = np.linspace(0, 1, n)
    if curve == "exp":
        f = f0 * (f1 / f0) ** x
    else:
        f = f0 + (f1 - f0) * x
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def lowpass(x, fc, order=4):
    sos = signal.butter(order, fc, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def highpass(x, fc, order=2):
    sos = signal.butter(order, fc, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def sweep_noise(rng, dur, f_start, f_end, width=0.55, env=None, lp=7000.0, bands=28):
    """
    Filtered noise with a smooth centre-frequency sweep, no harsh hiss: a bank of log-spaced band-passes is mixed with a
    gaussian weight around the (log-)swept centre, then low-passed. Vectorised and click-free.
    """
    t = tvec(dur)
    n = len(t)
    noise = rng.standard_normal(n)
    lo_f, hi_f = min(f_start, f_end) / 2.2, max(f_start, f_end) * 2.2
    hi_f = min(hi_f, 0.45 * SR)
    centres = np.geomspace(max(lo_f, 60.0), hi_f, bands)
    x = np.linspace(0, 1, n)
    sweep = np.log(f_start) + (np.log(f_end) - np.log(f_start)) * (0.5 - 0.5 * np.cos(np.pi * x))
    out = np.zeros(n)
    for fc in centres:
        band = bandpass(noise, fc / 1.25, min(fc * 1.25, 0.46 * SR), order=2)
        w = np.exp(-0.5 * ((np.log(fc) - sweep) / width) ** 2)
        out += band * w
    out = lowpass(out, lp, 4)
    if env is not None:
        out *= env
    return out


def bell(t, f, ratio=3.5, index=2.2, tau=0.22, a=0.004, partial=0.25):
    """Soft FM bell: carrier f modulated at f*ratio with a decaying index, plus a faint octave sine."""
    idx = index * np.exp(-t / (tau * 0.6))
    mod = np.sin(2 * np.pi * f * ratio * t)
    car = np.sin(2 * np.pi * f * t + idx * mod)
    car += partial * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / (tau * 0.5))
    return car * attack(t, a) * np.exp(-t / tau)


def place(buf, x, at):
    i = int(round(at * SR))
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]


def finish(x, dur=None):
    """Trim/pad to dur, remove DC, fade in/out, peak-normalise to PEAK_DB."""
    if dur is not None:
        n = int(round(dur * SR))
        x = x[:n] if len(x) >= n else np.pad(x, (0, n - len(x)))
    x = highpass(x, 18.0, 1)
    fi = int(FADE_IN_MS * 1e-3 * SR)
    fo = int(FADE_OUT_MS * 1e-3 * SR)
    ramp_in = 0.5 - 0.5 * np.cos(np.pi * np.arange(fi) / fi)
    ramp_out = 0.5 + 0.5 * np.cos(np.pi * np.arange(fo) / fo)
    x[:fi] *= ramp_in
    x[-fo:] *= ramp_out
    pk = np.max(np.abs(x))
    return x * (10 ** (PEAK_DB / 20) / pk)


# ---------------------------------------------------------------------------------------------------- families
# Each generator: (variant 1..3, rng) -> mono float array. Variants differ in pitch / timbre / timing.
def v_pick(variant, a, b, c):
    return (a, b, c)[variant - 1]


def gen_tap(v, rng):
    """Glass-like tap, ~55 ms: a short high sine burst + an inharmonic partial + a very soft high click."""
    t = tvec(0.055)
    f = v_pick(v, 2400.0, 2900.0, 2100.0)
    x = np.sin(2 * np.pi * f * t) * exp_decay(t, 0.0085)
    x += 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * exp_decay(t, 0.005)
    x += 0.18 * np.sin(2 * np.pi * f * 0.5 * t) * exp_decay(t, 0.012)
    click = highpass(lowpass(rng.standard_normal(len(t)), 9000, 2), 2500, 2) * exp_decay(t, 0.0012) * 0.35
    return (x + click) * attack(t, 0.0012)


def gen_tick(v, rng):
    """Lighter, shorter tick, ~28 ms: high-frequency glassy click."""
    t = tvec(0.028)
    f = v_pick(v, 4200.0, 3600.0, 4800.0)
    x = np.sin(2 * np.pi * f * t) * exp_decay(t, 0.0045)
    x += 0.35 * np.sin(2 * np.pi * f * 1.51 * t) * exp_decay(t, 0.003)
    click = highpass(lowpass(rng.standard_normal(len(t)), 10000, 2), 3500, 2) * exp_decay(t, 0.0008) * 0.25
    return (x + click) * attack(t, 0.0008)


def gen_pop(v, rng):
    """Small element appears, ~140 ms: a quick up-glide sine that blooms and decays, soft body."""
    t = tvec(0.14)
    f0, f1 = v_pick(v, (380.0, 820.0), (440.0, 960.0), (330.0, 700.0))
    glide = np.log(f0) + (np.log(f1) - np.log(f0)) * (1 - np.exp(-t / 0.022))
    ph = 2 * np.pi * np.cumsum(np.exp(glide)) / SR
    x = np.sin(ph) + 0.22 * np.sin(2 * ph) * exp_decay(t, 0.03)
    return x * attack(t, 0.004) * exp_decay(t, 0.042)


def gen_whoosh_soft(v, rng):
    """Soft whoosh, ~480 ms: gentle band sweep with a slow bell envelope; low-passed so there is no hiss."""
    dur = v_pick(v, 0.48, 0.52, 0.44)
    t = tvec(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2.2
    f0, f1 = v_pick(v, (350.0, 1500.0), (300.0, 1250.0), (420.0, 1700.0))
    return sweep_noise(rng, dur, f0, f1, width=0.6, env=env, lp=4500.0)


def gen_whoosh_fast(v, rng):
    """Fast whoosh, ~230 ms: quicker, brighter sweep, still capped well below harsh-hiss territory."""
    dur = v_pick(v, 0.23, 0.26, 0.21)
    t = tvec(dur)
    env = (attack(t, 0.05) * np.exp(-np.maximum(t - 0.07, 0) / 0.07))
    f0, f1 = v_pick(v, (600.0, 4200.0), (520.0, 3600.0), (700.0, 4800.0))
    return sweep_noise(rng, dur, f0, f1, width=0.5, env=env, lp=6500.0)


def gen_swipe(v, rng):
    """Swipe, ~190 ms: fast attack, medium decay, mid band with a trace of a pitched glide underneath."""
    dur = 0.19
    t = tvec(dur)
    env = attack(t, 0.012) * np.exp(-np.maximum(t - 0.012, 0) / 0.06)
    f0, f1 = v_pick(v, (1100.0, 2800.0), (900.0, 2300.0), (1300.0, 3200.0))
    n = sweep_noise(rng, dur, f0, f1, width=0.45, env=env, lp=5500.0)
    g = 0.16 * sine_sweep(t, v_pick(v, 520.0, 460.0, 580.0), v_pick(v, 820.0, 700.0, 900.0)) * env
    return n + g * np.max(np.abs(n))


def gen_slide(v, rng):
    """Slide, ~380 ms: slower, lower, symmetric band sweep with a soft body tone."""
    dur = v_pick(v, 0.38, 0.42, 0.34)
    t = tvec(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    f0, f1 = v_pick(v, (260.0, 900.0), (220.0, 760.0), (300.0, 1000.0))
    n = sweep_noise(rng, dur, f0, f1, width=0.5, env=env, lp=3200.0)
    body = 0.12 * sine_sweep(t, f0 * 0.6, f1 * 0.45) * env
    return n + body * np.max(np.abs(n))


def gen_rise(v, rng):
    """Number going up, ~320 ms: soft pitched up-sweep (about a fifth), gentle tail."""
    t = tvec(0.32)
    f0 = v_pick(v, 520.0, 620.0, 440.0)
    ph = sine_sweep(t, f0, f0 * 1.5)
    x = ph + 0.2 * np.sin(2 * np.pi * 2.0 * np.cumsum(f0 * (1.5 ** (t / t[-1]))) / SR)
    return x * attack(t, 0.02) * np.exp(-np.maximum(t - 0.12, 0) / 0.11)


def gen_fall(v, rng):
    """Number going down, ~340 ms: soft pitched down-sweep, slightly darker and slower than rise."""
    t = tvec(0.34)
    f0 = v_pick(v, 760.0, 880.0, 660.0)
    x = sine_sweep(t, f0, f0 / 1.5)
    x += 0.15 * sine_sweep(t, f0 * 2, f0 * 2 / 1.5)
    return x * attack(t, 0.02) * np.exp(-np.maximum(t - 0.1, 0) / 0.13)


def gen_chime_success(v, rng):
    """Success chime, ~1 s: three rising FM-bell notes (major triad), gentle decay."""
    notes = v_pick(v, (784.0, 987.8, 1174.7), (698.5, 880.0, 1046.5), (880.0, 1108.7, 1318.5))
    buf = np.zeros(int(1.05 * SR))
    for i, (f, at, g) in enumerate(zip(notes, (0.0, 0.085, 0.17), (0.8, 0.9, 1.0))):
        n = tvec(0.9)
        place(buf, g * bell(n, f, ratio=3.5, index=1.8, tau=0.24 + 0.04 * i), at)
    return buf


def gen_soft_warn(v, rng):
    """Soft warning, ~520 ms: two softer notes stepping down (a fourth), low FM index so it reads as 'careful', not alarm."""
    notes = v_pick(v, (659.3, 493.9), (587.3, 440.0), (698.5, 523.3))
    buf = np.zeros(int(0.55 * SR))
    for f, at, g in zip(notes, (0.0, 0.13), (0.9, 1.0)):
        n = tvec(0.4)
        place(buf, g * bell(n, f, ratio=2.0, index=0.9, tau=0.14, a=0.006, partial=0.12), at)
    return buf


def gen_number_tick(v, rng):
    """Very quiet digit-roll tick, ~30 ms (the cue system plays it at a low default gain)."""
    t = tvec(0.03)
    f = v_pick(v, 3000.0, 3400.0, 2700.0)
    x = np.sin(2 * np.pi * f * t) * exp_decay(t, 0.006)
    x += 0.2 * highpass(lowpass(rng.standard_normal(len(t)), 7000, 2), 2500, 2) * exp_decay(t, 0.001)
    return x * attack(t, 0.001)


def gen_impact_soft(v, rng):
    """Big-reveal thud, ~480 ms: sub-bass sine with a fast pitch drop, a hint of low noise body, no click."""
    t = tvec(0.48)
    f0, f1 = v_pick(v, (88.0, 42.0), (100.0, 46.0), (76.0, 38.0))
    glide = f1 + (f0 - f1) * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(glide) / SR
    x = np.sin(ph) * exp_decay(t, 0.13)
    x += 0.25 * np.sin(2 * ph) * exp_decay(t, 0.05)
    x += 0.35 * lowpass(rng.standard_normal(len(t)), 220, 2) * exp_decay(t, 0.03)
    return x * attack(t, 0.006)


FAMILIES = {
    "tap": gen_tap,
    "tick": gen_tick,
    "pop": gen_pop,
    "whoosh-soft": gen_whoosh_soft,
    "whoosh-fast": gen_whoosh_fast,
    "swipe": gen_swipe,
    "slide": gen_slide,
    "rise": gen_rise,
    "fall": gen_fall,
    "chime-success": gen_chime_success,
    "soft-warn": gen_soft_warn,
    "number-tick": gen_number_tick,
    "impact-soft": gen_impact_soft,
}
VARIANTS = 3


# ------------------------------------------------------------------------------------------------- measurement
def k_weight(x):
    """ITU-R BS.1770 K-weighting (48 kHz coefficients)."""
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x))


def lufs_estimate(x):
    """
    Loudness estimate in LUFS. Files are shorter than a 400 ms gating block, so this is the K-weighted mean square over the
    whole file (ungated) - a stable *relative* number, not a spec-compliant integrated measurement.
    """
    ms = np.mean(k_weight(x) ** 2)
    return -0.691 + 10 * np.log10(max(ms, 1e-12))


def active_rms_db(x, floor_db=-40.0):
    """RMS (dBFS) over the samples within `floor_db` of the peak - the level while the sound is actually sounding."""
    thr = np.max(np.abs(x)) * 10 ** (floor_db / 20)
    a = x[np.abs(x) >= thr]
    return 20 * np.log10(max(np.sqrt(np.mean(a**2)), 1e-9))


# ------------------------------------------------------------------------------------------------------ writing
def write_wav24(path, x):
    """x: float array (n,) or (n, ch) in [-1, 1]. Writes 48 kHz 24-bit PCM."""
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    ints = np.round(np.clip(x, -1, 1) * 8388607).astype(np.int32)
    flat = ints.reshape(-1)
    b = np.empty((len(flat), 3), dtype=np.uint8)
    b[:, 0] = flat & 0xFF
    b[:, 1] = (flat >> 8) & 0xFF
    b[:, 2] = (flat >> 16) & 0xFF
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b.tobytes())


def pan_stereo(x, pos):
    """Equal-power pan; scaled so the louder channel equals the mono file (peak stays at -3 dBFS)."""
    ang = (pos + 1) * np.pi / 4
    l, r = np.cos(ang), np.sin(ang)
    return np.stack([x * l, x * r], axis=1) / max(l, r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/kit/sfx")
    ap.add_argument("--ts-manifest", default="src/kit/audio/sfx-manifest.json")
    ap.add_argument("--no-pan", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    entries = []
    for family, gen in FAMILIES.items():
        for v in range(1, VARIANTS + 1):
            raw = gen(v, rng_for(family, v))
            x = finish(raw.astype(np.float64))
            name = f"{family}-{v}"
            write_wav24(os.path.join(args.out, f"{name}.wav"), x)
            pan = []
            if not args.no_pan:
                for tag, pos in (("L", -PAN_POS), ("R", PAN_POS)):
                    st = pan_stereo(x, pos)
                    write_wav24(os.path.join(args.out, f"{name}@{tag}.wav"), st)
                    pan.append(tag)
            entries.append(
                {
                    "name": name,
                    "family": family,
                    "variant": v,
                    "file": f"kit/sfx/{name}.wav",
                    "pan": pan,
                    "duration": round(len(x) / SR, 4),
                    "peakDb": round(20 * np.log10(np.max(np.abs(x))), 2),
                    "peakTime": round(float(np.argmax(np.abs(x))) / SR, 4),
                    "rmsDb": round(float(active_rms_db(x)), 2),
                    "lufs": round(float(lufs_estimate(x)), 2),
                }
            )
    manifest = {
        "version": 1,
        "sampleRate": SR,
        "bitDepth": 24,
        "peakDbTarget": PEAK_DB,
        "lufsNote": "K-weighted ungated mean-square over the whole (sub-400ms) file; relative estimate, not BS.1770 integrated.",
        "panNote": f"@L/@R files are stereo, equal-power pan at -/+{PAN_POS}.",
        "sounds": entries,
    }
    with open(os.path.join(args.out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    os.makedirs(os.path.dirname(args.ts_manifest), exist_ok=True)
    shutil.copyfile(os.path.join(args.out, "manifest.json"), args.ts_manifest)

    print(f"{'name':<18}{'dur s':>7}{'peak dB':>9}{'rms dB':>8}{'LUFS':>8}")
    for e in entries:
        print(f"{e['name']:<18}{e['duration']:>7.3f}{e['peakDb']:>9.2f}{e['rmsDb']:>8.1f}{e['lufs']:>8.1f}")


if __name__ == "__main__":
    main()
