#!/usr/bin/env python3
"""
kit_make_sfx.py - original, synthesized iOS-style UI sounds for the reusable kit (src/kit/audio).

Everything is generated from scratch with numpy + scipy: sines, FM bells and filtered noise. Nothing is sampled and
nothing is copied from scripts/make_sfx.py, foley/ or public/music.mp3. The sounds are *in the style of* soft, short,
clean system UI feedback; they are not reproductions of any real product sound.

One system (see scripts/sfx_key.py and src/kit/audio/README.md): every tonal part sits in ONE key (C major pentatonic),
most families share ONE synthetic room (send amounts in WET below), pop/tap/swipe/slide carry a subtle noise-transient
texture (TEXTURE below) and number-tick / pop / tick also exist as 12-note pitched sets for data values (pitched/).

Output (48 kHz, 24-bit WAV, 6 ms fade-in / >=10 ms fade-out, peak normalised to -3 dBFS):
  public/kit/sfx/<family>-<1..3>.wav          mono, centre
  public/kit/sfx/<family>-<1..3>@L.wav|@R.wav stereo pre-panned (equal-power, +-0.75). Remotion's <Audio> has no pan
                                              prop, so the cue system picks these for panned cues. --no-pan skips them.
  public/kit/sfx/pitched/<family>-n00..n11.wav (+ @L/@R)   12 scale notes for number-tick, pop and tick
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
import sys
import wave
import zlib

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfx_key import KEY_NAME, SCALE_PITCH_CLASSES, NOTE_NAMES, midi_to_freq, note_freq, note_to_midi, scale_notes  # noqa: E402

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
    """Add x into buf at `at` seconds. Raises instead of truncating: a note cut by the buffer end clicks."""
    i = int(round(at * SR))
    j = i + len(x)
    if j > len(buf):
        raise ValueError(f"place(): note of {len(x)} samples at {at}s does not fit in a buffer of {len(buf)} samples")
    buf[i:j] += x


def fade_out(x, seconds):
    """Raised-cosine fade to zero over the last `seconds` (in place on a copy)."""
    n = min(len(x), max(2, int(round(seconds * SR))))
    y = x.copy()
    y[-n:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(n) / n)
    return y


def log_glide(n, f0, f1, hold, glide):
    """
    Per-sample frequency: f0 for `hold` s, then a raised-cosine glide in log-frequency to f1 over `glide` s, then f1.
    Both ends sit exactly on their notes (an exponential glide would only approach f1).
    """
    t = np.arange(n) / SR
    s_ = np.clip((t - hold) / max(glide, 1e-6), 0.0, 1.0)
    s_ = 0.5 - 0.5 * np.cos(np.pi * s_)
    return f0 * (f1 / f0) ** s_


def phase_of(freq):
    return 2 * np.pi * np.cumsum(freq) / SR


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


# ------------------------------------------------------------------------------------------------- the key
# Note tables (names from sfx_key.py: D major pentatonic = D E F# A B). Three variants = three scale-degree choices.
# The ticks keep their old register: the old frequency was snapped to the nearest scale note (in cents).
TAP_NOTES = ("E6", "F#6", "D6")  # an octave under the old register: at 2.1-2.6 kHz about 90% of a tap sat in the harsh 2-5 kHz band
TICK_NOTES = ("D8", "B7", "E8")  # was 4200 / 3600 / 4800 Hz
NUMBER_TICK_NOTES = ("A7", "B7", "F#7")  # was 3000 / 3400 / 2700 Hz
POP_NOTES = (("A4", "A5"), ("B4", "B5"), ("F#4", "F#5"))  # (glide start, glide END) - an octave up, landing on the note
RISE_NOTES = (("D5", "A5"), ("E5", "B5"), ("B4", "F#5"))  # fifth up, both ends on scale notes
FALL_NOTES = (("B5", "E5"), ("A5", "D5"), ("F#5", "B4"))  # fifth down
CHIME_NOTES = (("D5", "F#5", "A5"), ("E5", "A5", "B5"), ("F#5", "A5", "D6"))  # rising triads from scale degrees
BRAND_NOTES = (("A4", "D5", "F#5"), ("B4", "E5", "A5"), ("F#4", "A4", "D5"))  # brand chime: three scale notes, softer and lower than the success chime
WARN_NOTES = (("A5", "E5"), ("B5", "F#5"), ("F#5", "B4"))  # falling fifth within the scale
IMPACT_NOTES = (("A2", "A1"), ("D3", "D2"), ("A3", "A2"))  # (start, END): octave drop onto A, D, A (close together: one family, three weights)
KNOCK_NOTES = ("A3", "D4", "F#3")  # tone of the impact-soft mid "knock" layer (150-400 Hz)

# Pitched sets for data values: 12 consecutive scale notes (2.4 octaves) per family.
PITCHED_STARTS = {"number-tick": "D6", "tick": "D6", "pop": "D4"}  # D6..E8 for the ticks (1.2-5.3 kHz), D4..E6 for pop
PITCHED_COUNT = 12
PITCHED_FAMILIES = tuple(PITCHED_STARTS)


def pitched_notes(family):
    return scale_notes(PITCHED_STARTS[family], PITCHED_COUNT)


# --------------------------------------------------------------------------------------------- the shared room
# ONE deterministic synthetic impulse response: exponentially decaying band-limited noise. Every family is sent to it
# with the wet amount below (energy fraction of the final mix: out = sqrt(1-w) dry + sqrt(w) room, IR has unit in-band power gain).
ROOM = {"rt60_s": 0.42, "predelay_s": 0.007, "highcut_hz": 6500.0, "lowcut_hz": 100.0, "length_s": 0.52}
WET = {  # per-family send. EDIT HERE to change how much room a family gets (0 = fully dry). 0.04 = -14 dB, 0.08 = -11 dB.
    # Chosen with the room normalised by in-band gain (see room_ir): the highest send at which each family stays within ~2.5 dB
    # of its pre-room level and its three variants stay within 2 LU of each other. Pure tones in a room ripple (a swept tone
    # sees the room's random frequency response), so the swept families (rise, fall) and the two-note ones get the least.
    "tap": 0.04,
    "tick": 0.03,
    "pop": 0.08,
    "whoosh-soft": 0.06,
    "whoosh-fast": 0.04,
    "swipe": 0.04,
    "slide": 0.06,
    "rise": 0.05,
    "fall": 0.04,
    "chime-success": 0.08,
    "brand-chime": 0.08,
    "soft-warn": 0.04,
    "number-tick": 0.03,
    "impact-soft": 0.08,
}
# Longest room tail added after the dry sound (seconds). The room itself rings for ~0.4 s, but a file's duration is also its
# slot in the cue system's polyphony limit (number rolls!), so every family gets only as much tail as keeps it inside the
# length its role allows (see scripts/sfx_report_thresholds.json). The tail is cut where the mix is 55 dB under its peak or
# at the cap, whichever is first, and always ends in a fade, so it is a short room "bloom", not a long reverb.
TAIL_CAP_S = {
    "tap": 0.015, "tick": 0.0, "number-tick": 0.0, "swipe": 0.060, "whoosh-fast": 0.060,
    "pop": 0.050, "whoosh-soft": 0.080, "slide": 0.080, "rise": 0.080, "fall": 0.080,
    "chime-success": 0.090, "brand-chime": 0.090, "soft-warn": 0.090, "impact-soft": 0.100,
}
TAIL_CAP_DEFAULT_S = 0.10
TAIL_FLOOR_DB = -55.0
# Raised-cosine taper (s) at the end of the DRY sound before it enters the room, so nothing is cut while still loud.
END_TAPER_S = {"whoosh-fast": 0.085, "swipe": 0.075, "whoosh-soft": 0.06, "slide": 0.06}
END_TAPER_DEFAULT_S = 0.025

_IR_CACHE = {}


def room_ir():
    """The shared room's impulse response (cached; seeded, so identical on every run)."""
    if "ir" not in _IR_CACHE:
        rng = np.random.default_rng(zlib.crc32(b"room-ir"))
        n = int(round(ROOM["length_s"] * SR))
        t = np.arange(n) / SR
        noise = rng.standard_normal(n)
        noise = lowpass(noise, ROOM["highcut_hz"], 4)
        noise = highpass(noise, ROOM["lowcut_hz"], 2)
        ir = noise * 10 ** (-3.0 * t / ROOM["rt60_s"])  # amplitude -60 dB at rt60
        k = int(0.02 * SR)
        ir[-k:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(k) / k)
        ir = np.concatenate([np.zeros(int(round(ROOM["predelay_s"] * SR))), ir])
        # Normalise by the IN-BAND power gain, not by total energy. The room only passes lowcut..highcut, so a unit-energy IR
        # has |H(f)|^2 ~ 3.7 (+5.7 dB) inside that band; a tone or any band-limited sound would then get ~4x the wet energy it
        # was sent, plus Rayleigh peaks up to +3.5 dB over the dry sound. With this, `wet` is the energy fraction of the mix for
        # any input that sits inside the room's band.
        H = np.fft.rfft(ir, 1 << 17)
        f = np.fft.rfftfreq(1 << 17, 1 / SR)
        band = (f >= ROOM["lowcut_hz"]) & (f <= ROOM["highcut_hz"])
        _IR_CACHE["ir"] = ir / np.sqrt(np.mean(np.abs(H[band]) ** 2))
    return _IR_CACHE["ir"]


def apply_room(body, wet, tail_cap_s):
    """Dry body + wet send of the shared room, extended by the room tail (cut 55 dB under peak, capped), faded out."""
    if wet <= 0:
        return body
    rev = signal.fftconvolve(body, room_ir())
    dry = np.pad(body, (0, len(rev) - len(body)))
    mix = np.sqrt(1.0 - wet) * dry + np.sqrt(wet) * rev
    blk = int(0.002 * SR)
    nb = int(np.ceil(len(mix) / blk))
    peaks = np.max(np.abs(np.pad(mix, (0, nb * blk - len(mix))).reshape(nb, blk)), axis=1)
    above = np.nonzero(peaks >= peaks.max() * 10 ** (TAIL_FLOOR_DB / 20))[0]
    end = int((above[-1] + 1) * blk)
    end = int(np.clip(end, len(body), len(body) + int(round(tail_cap_s * SR))))
    out = mix[:end]
    tail = (end - len(body)) / SR
    return fade_out(out, max(0.010, min(0.040, 0.5 * tail)))


# ------------------------------------------------------------------------------------------------- texture layer
# A subtle synthesized noise transient on the onset of tap / pop / swipe / slide. Level = PEAK of the transient relative
# to the PEAK of the main layer (the tone for tap and pop; the sweep + glide body for swipe and slide, which have no
# separate tone at that level). band = band-pass edges in Hz, dur = transient length in seconds, attack = rise time in seconds
# (default 1.5 ms; a faster one is itself a >8 kHz click, and a body that is quiet at its onset needs a slower one).
TEXTURE = {
    "tap": {"band": (1500.0, 6000.0), "dur": 0.010, "level_db": -18.0},
    "pop": {"band": (300.0, 1800.0), "dur": 0.018, "level_db": -17.0},
    "swipe": {"band": (2500.0, 7000.0), "dur": 0.012, "level_db": -18.0},
    "slide": {"band": (500.0, 2200.0), "dur": 0.030, "level_db": -20.0, "attack": 0.004},  # a soft grain, not a transient
}
ONSET_FRACTION = 0.05  # onset = first point where the 1 ms-smoothed envelope reaches 5% of its peak (texture is placed there)


def onset_index(x):
    env = np.convolve(np.abs(x), np.ones(max(1, int(0.001 * SR))) / max(1, int(0.001 * SR)), mode="same")
    return int(np.argmax(env >= ONSET_FRACTION * env.max()))


def add_texture(family, variant, body):
    cfg = TEXTURE[family]
    rng = np.random.default_rng(zlib.crc32(f"{family}:{variant}:texture".encode()))
    n = int(round(cfg["dur"] * SR))
    t = np.arange(n) / SR
    lo, hi = cfg["band"]
    x = bandpass(rng.standard_normal(n + int(0.02 * SR)), lo, hi, 2)[int(0.02 * SR) :]  # skip the filter start-up
    env = attack(t, cfg.get("attack", 0.0015)) * np.exp(-t / (cfg["dur"] / 4.0))
    env *= 0.5 + 0.5 * np.cos(np.pi * np.clip((t - 0.6 * cfg["dur"]) / (0.4 * cfg["dur"]), 0.0, 1.0))
    x = x * env
    x *= (np.max(np.abs(body)) * 10 ** (cfg["level_db"] / 20)) / np.max(np.abs(x))
    # Aligned to where the body really starts (5% of its peak). Clamping this to the first few ms put the transient alone, ahead
    # of a slowly rising body (slide is ~40 dB down for its first 10 ms), where it is louder than the sound it decorates: a click.
    start = onset_index(body)
    out = body.copy()
    m = min(n, len(out) - start)
    out[start : start + m] += x[:m]
    return out


# ---------------------------------------------------------------------------------------------------- families
# Each generator: (variant 1..3, rng, note=None) -> mono float array (the DRY sound). `note` overrides the note table
# (used by the pitched sets). Variants differ in scale degree / timbre / timing.
def v_pick(variant, a, b, c):
    return (a, b, c)[variant - 1]


def gen_tap(v, rng, note=None):
    """Glass-like tap, ~55 ms: a short high sine burst + an inharmonic partial + a very soft high click."""
    t = tvec(0.055)
    f = note_freq(note or TAP_NOTES[v - 1])
    x = np.sin(2 * np.pi * f * t) * exp_decay(t, 0.0085)
    x += 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * exp_decay(t, 0.005)
    x += 0.18 * np.sin(2 * np.pi * f * 0.5 * t) * exp_decay(t, 0.012)
    click = highpass(lowpass(rng.standard_normal(len(t)), 9000, 2), 2500, 2) * exp_decay(t, 0.0012) * 0.35
    return (x + click) * attack(t, 0.0012)


def gen_tick(v, rng, note=None):
    """Lighter, shorter tick, ~28 ms: high-frequency glassy click."""
    t = tvec(0.028)
    f = note_freq(note or TICK_NOTES[v - 1])
    x = np.sin(2 * np.pi * f * t) * exp_decay(t, 0.0045)
    x += 0.35 * np.sin(2 * np.pi * f * 1.51 * t) * exp_decay(t, 0.003)
    click = highpass(lowpass(rng.standard_normal(len(t)), 10000, 2), 3500, 2) * exp_decay(t, 0.0008) * 0.25
    return (x + click) * attack(t, 0.0008)


POP_BODY_LEVEL = 0.4  # peak of pop's low body relative to its main tone


def pop_body_hz(note):
    """The landing note's pitch class in octave 3 (131-220 Hz): a low body in key, in the same register for every pop."""
    return note_freq(note.rstrip("-0123456789") + "3")


def gen_pop(v, rng, note=None):
    """Small element appears, ~140 ms: an octave up-glide that lands on a scale note, blooms and decays, soft body."""
    t = tvec(0.14)
    if note:
        f1 = note_freq(note)
        f0 = f1 / 2.0
    else:
        f0, f1 = (note_freq(n) for n in POP_NOTES[v - 1])
    ph = phase_of(log_glide(len(t), f0, f1, hold=0.0, glide=0.045))
    x = np.sin(ph) + 0.22 * np.sin(2 * ph) * exp_decay(t, 0.03)
    main = x * attack(t, 0.004) * exp_decay(t, 0.042)
    # A soft low "thup" under the glide, so the pop has some weight and is not only a mid-range blip.
    body = np.sin(2 * np.pi * pop_body_hz(note or POP_NOTES[v - 1][1]) * t) * attack(t, 0.006) * exp_decay(t, 0.03)
    return main + POP_BODY_LEVEL * body


def gen_whoosh_soft(v, rng, note=None):
    """Soft whoosh, ~480 ms: gentle band sweep with a slow bell envelope; low-passed so there is no hiss."""
    dur = v_pick(v, 0.48, 0.52, 0.44)
    t = tvec(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2.2
    f0, f1 = v_pick(v, (350.0, 1500.0), (300.0, 1250.0), (370.0, 1550.0))
    return sweep_noise(rng, dur, f0, f1, width=0.6, env=env, lp=4500.0)


def gen_whoosh_fast(v, rng, note=None):
    """Fast whoosh, ~230 ms: quicker, brighter sweep, still capped well below harsh-hiss territory."""
    dur = v_pick(v, 0.23, 0.26, 0.21)
    t = tvec(dur)
    env = attack(t, 0.05) * np.exp(-np.maximum(t - 0.07, 0) / 0.07)
    f0, f1 = v_pick(v, (600.0, 4200.0), (520.0, 3600.0), (700.0, 4800.0))
    return sweep_noise(rng, dur, f0, f1, width=0.5, env=env, lp=6500.0)


def gen_swipe(v, rng, note=None):
    """Swipe, ~190 ms: fast attack, medium decay, mid band with a trace of a pitched glide underneath."""
    dur = 0.19
    t = tvec(dur)
    env = attack(t, 0.012) * np.exp(-np.maximum(t - 0.012, 0) / 0.06)
    f0, f1 = v_pick(v, (1100.0, 2800.0), (900.0, 2300.0), (1300.0, 3200.0))
    n = sweep_noise(rng, dur, f0, f1, width=0.45, env=env, lp=5500.0)
    g = 0.16 * sine_sweep(t, v_pick(v, 520.0, 460.0, 580.0), v_pick(v, 820.0, 700.0, 900.0)) * env
    return n + g * np.max(np.abs(n))


def gen_slide(v, rng, note=None):
    """Slide, ~380 ms: slower, lower, symmetric band sweep with a soft body tone."""
    dur = v_pick(v, 0.38, 0.42, 0.34)
    t = tvec(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    f0, f1 = v_pick(v, (260.0, 900.0), (220.0, 760.0), (300.0, 1000.0))
    n = sweep_noise(rng, dur, f0, f1, width=0.5, env=env, lp=3200.0)
    body = 0.12 * sine_sweep(t, f0 * 0.6, f1 * 0.45) * env
    return n + body * np.max(np.abs(n))


def gen_rise(v, rng, note=None):
    """Number going up, ~320 ms: a fifth up between two scale notes (held, glided, held), gentle tail."""
    t = tvec(0.32)
    f0, f1 = (note_freq(n) for n in RISE_NOTES[v - 1])
    ph = phase_of(log_glide(len(t), f0, f1, hold=0.05, glide=0.10))
    x = np.sin(ph) + 0.2 * np.sin(2 * ph)
    return x * attack(t, 0.02) * np.exp(-np.maximum(t - 0.12, 0) / 0.11)


def gen_fall(v, rng, note=None):
    """Number going down, ~340 ms: a fifth down between two scale notes, slightly darker and slower than rise."""
    t = tvec(0.34)
    f0, f1 = (note_freq(n) for n in FALL_NOTES[v - 1])
    ph = phase_of(log_glide(len(t), f0, f1, hold=0.05, glide=0.10))
    x = np.sin(ph) + 0.15 * np.sin(2 * ph)
    return x * attack(t, 0.02) * np.exp(-np.maximum(t - 0.1, 0) / 0.13)


CHIME_NOTE_S = 0.9  # length of each chime note; every note ends in a NOTE_FADE_S raised-cosine fade, never in a cut
WARN_NOTE_S = 0.4
NOTE_FADE_S = 0.035


def gen_chime_success(v, rng, note=None):
    """Success chime, ~1.07 s: three rising FM-bell notes (a triad from the scale), gentle decay."""
    notes = [note_freq(n) for n in CHIME_NOTES[v - 1]]
    starts = (0.0, 0.085, 0.17)
    buf = np.zeros(int(round((starts[-1] + CHIME_NOTE_S) * SR)))
    for i, (f, at, g) in enumerate(zip(notes, starts, (0.8, 0.9, 1.0))):
        n = fade_out(bell(tvec(CHIME_NOTE_S), f, ratio=3.5, index=1.8, tau=0.24 + 0.04 * i), NOTE_FADE_S)
        place(buf, g * n, at)
    return buf


def gen_brand_chime(v, rng, note=None):
    """Brand chime, ~1 s: three soft FM-bell notes from the D major pentatonic, spaced out, low FM index, long gentle decay."""
    notes = [note_freq(n) for n in BRAND_NOTES[v - 1]]
    starts = (0.0, 0.2, 0.4)
    note_s = 0.6
    buf = np.zeros(int(round((starts[-1] + note_s) * SR)))
    for i, (f, at, g) in enumerate(zip(notes, starts, (0.75, 0.85, 1.0))):
        n = fade_out(bell(tvec(note_s), f, ratio=3.5, index=1.2, tau=0.2 + 0.05 * i, partial=0.18), NOTE_FADE_S)
        place(buf, g * n, at)
    return buf


def gen_soft_warn(v, rng, note=None):
    """Soft warning, ~530 ms: two softer notes stepping down a fifth within the scale; low FM index so it reads 'careful'."""
    notes = [note_freq(n) for n in WARN_NOTES[v - 1]]
    starts = (0.0, 0.13)
    buf = np.zeros(int(round((starts[-1] + WARN_NOTE_S) * SR)))
    for f, at, g in zip(notes, starts, (0.9, 1.0)):
        n = fade_out(bell(tvec(WARN_NOTE_S), f, ratio=2.0, index=0.9, tau=0.14, a=0.006, partial=0.12), NOTE_FADE_S)
        place(buf, g * n, at)
    return buf


def gen_number_tick(v, rng, note=None):
    """Very quiet digit-roll tick, ~30 ms (the cue system plays it at a low default gain)."""
    t = tvec(0.03)
    f = note_freq(note or NUMBER_TICK_NOTES[v - 1])
    x = np.sin(2 * np.pi * f * t) * exp_decay(t, 0.006)
    x += 0.3 * np.sin(2 * np.pi * f * 0.5 * t) * exp_decay(t, 0.006)  # the octave below (same note): less of a bare beep
    x += 0.2 * highpass(lowpass(rng.standard_normal(len(t)), 7000, 2), 2500, 2) * exp_decay(t, 0.001)
    return x * attack(t, 0.001)


KNOCK_DB = -12.0  # knock peak relative to the sub peak
KNOCK_S = 0.10


def gen_impact_soft(v, rng, note=None):
    """Big-reveal thud, ~480 ms: sub-bass sine that drops an octave onto the fifth / tonic, a mid 'knock', no click."""
    t = tvec(0.48)
    f0, f1 = (note_freq(n) for n in IMPACT_NOTES[v - 1])
    ph = phase_of(log_glide(len(t), f0, f1, hold=0.0, glide=0.08))
    sub = np.sin(ph) * exp_decay(t, 0.13)
    sub += 0.25 * np.sin(2 * ph) * exp_decay(t, 0.05)
    sub += 0.35 * lowpass(rng.standard_normal(len(t)), 220, 2) * exp_decay(t, 0.03)
    sub *= attack(t, 0.006)
    # Mid knock: a short tone (scale note, 150-400 Hz) plus band-limited noise so the hit is audible on phone speakers.
    kr = np.random.default_rng(zlib.crc32(f"impact-soft:{v}:knock".encode()))
    kt = tvec(KNOCK_S)
    knock = np.sin(2 * np.pi * note_freq(KNOCK_NOTES[v - 1]) * kt) * exp_decay(kt, 0.03)
    knock += 0.6 * bandpass(kr.standard_normal(len(kt)), 150.0, 400.0, 2) * exp_decay(kt, 0.02)
    knock *= attack(kt, 0.002) * (0.5 + 0.5 * np.cos(np.pi * np.clip((kt - 0.07) / 0.03, 0, 1)))
    knock *= (np.max(np.abs(sub)) * 10 ** (KNOCK_DB / 20)) / np.max(np.abs(knock))
    sub[: len(knock)] += knock
    return sub


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
    "brand-chime": gen_brand_chime,
    "soft-warn": gen_soft_warn,
    "number-tick": gen_number_tick,
    "impact-soft": gen_impact_soft,
}
VARIANTS = 3


def sound_notes(family, v):
    """Scale notes a sound is tuned to (for the manifest and the pitch check), or None for noise-only sounds."""
    table = {
        "tap": TAP_NOTES[v - 1:v], "tick": TICK_NOTES[v - 1:v], "number-tick": NUMBER_TICK_NOTES[v - 1:v],
        "pop": POP_NOTES[v - 1], "rise": RISE_NOTES[v - 1], "fall": FALL_NOTES[v - 1], "chime-success": CHIME_NOTES[v - 1], "brand-chime": BRAND_NOTES[v - 1],
        "soft-warn": WARN_NOTES[v - 1], "impact-soft": IMPACT_NOTES[v - 1] + KNOCK_NOTES[v - 1:v],
    }
    notes = table.get(family)
    return list(notes) if notes else None


def render(family, variant, rng, note=None):
    """Dry generator -> texture -> end taper -> shared room (send + tail) -> finish (DC, fades, -3 dBFS peak)."""
    body = FAMILIES[family](variant, rng, note=note).astype(np.float64)
    if family in TEXTURE:
        body = add_texture(family, variant, body)
    body = fade_out(body, END_TAPER_S.get(family, END_TAPER_DEFAULT_S))
    out = apply_room(body, WET.get(family, 0.0), TAIL_CAP_S.get(family, TAIL_CAP_DEFAULT_S))
    return finish(out)


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


def write_set(out_dir, name, x, pan_enabled):
    """Write <name>.wav (+ @L/@R) and return (pan list, mono x)."""
    write_wav24(os.path.join(out_dir, f"{name}.wav"), x)
    pan = []
    if pan_enabled:
        for tag, pos in (("L", -PAN_POS), ("R", PAN_POS)):
            write_wav24(os.path.join(out_dir, f"{name}@{tag}.wav"), pan_stereo(x, pos))
            pan.append(tag)
    return pan


def measurements(x):
    return {
        "duration": round(len(x) / SR, 4),
        "peakDb": round(20 * np.log10(np.max(np.abs(x))), 2),
        "peakTime": round(float(np.argmax(np.abs(x))) / SR, 4),
        "rmsDb": round(float(active_rms_db(x)), 2),
        "lufs": round(float(lufs_estimate(x)), 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/kit/sfx")
    ap.add_argument("--ts-manifest", default="src/kit/audio/sfx-manifest.json")
    ap.add_argument("--no-pan", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    pitched_dir = os.path.join(args.out, "pitched")
    os.makedirs(pitched_dir, exist_ok=True)

    entries = []
    for family in FAMILIES:
        for v in range(1, VARIANTS + 1):
            x = render(family, v, rng_for(family, v))
            name = f"{family}-{v}"
            pan = write_set(args.out, name, x, not args.no_pan)
            entry = {"name": name, "family": family, "variant": v, "file": f"kit/sfx/{name}.wav", "pan": pan}
            entry.update(measurements(x))
            entry["wet"] = WET.get(family, 0.0)
            notes = sound_notes(family, v)
            if notes:
                entry["notes"] = notes
            entries.append(entry)

    pitched = []
    for family in PITCHED_FAMILIES:
        for i, note in enumerate(pitched_notes(family)):
            x = render(family, 1, rng_for(f"{family}@pitched", i), note=note)
            name = f"{family}-n{i:02d}"
            pan = write_set(pitched_dir, name, x, not args.no_pan)
            entry = {"name": name, "family": family, "variant": 0, "noteIndex": i, "note": note, "midi": note_to_midi(note),
                     "file": f"kit/sfx/pitched/{name}.wav", "pan": pan}
            entry.update(measurements(x))
            entry["wet"] = WET.get(family, 0.0)
            pitched.append(entry)

    manifest = {
        "version": 1,
        "sampleRate": SR,
        "bitDepth": 24,
        "peakDbTarget": PEAK_DB,
        "lufsNote": "K-weighted ungated mean-square over the whole file; relative estimate, not BS.1770 integrated.",
        "panNote": f"@L/@R files are stereo, equal-power pan at -/+{PAN_POS}.",
        "key": {"name": KEY_NAME, "tonic": "C", "scale": [NOTE_NAMES[p] for p in SCALE_PITCH_CLASSES], "a4Hz": 440.0},
        "room": {**ROOM, "wetByFamily": WET, "tailFloorDb": TAIL_FLOOR_DB, "tailCapSeconds": TAIL_CAP_S, "tailCapDefaultSeconds": TAIL_CAP_DEFAULT_S},
        "texture": TEXTURE,
        "sounds": entries,
        "pitched": pitched,
    }
    with open(os.path.join(args.out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    os.makedirs(os.path.dirname(args.ts_manifest) or ".", exist_ok=True)
    shutil.copyfile(os.path.join(args.out, "manifest.json"), args.ts_manifest)

    print(f"{'name':<18}{'dur s':>7}{'peak dB':>9}{'rms dB':>8}{'LUFS':>8}")
    for e in entries + pitched:
        print(f"{e['name']:<18}{e['duration']:>7.3f}{e['peakDb']:>9.2f}{e['rmsDb']:>8.1f}{e['lufs']:>8.1f}")


if __name__ == "__main__":
    main()
