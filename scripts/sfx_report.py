#!/usr/bin/env python3
"""
sfx_report.py - measures the generated UI sounds and flags measurable issues. It does not say whether a sound is good:
judge that by ear (see scripts/sfx_build_page.py for the listening page).

Reads the mono WAVs in public/kit/sfx/ (the pre-panned @L / @R copies are skipped) and writes, to dist/sfx-report/:
  report.json, report.md, spectrograms/<name>.png, contact-sheet.png

Thresholds: scripts/sfx_report_thresholds.json. Rule checks of the cue system stay in kit-audio-check.mjs, and loudness
of rendered videos in kit_loudness.mjs; neither is repeated here.

Usage:  python3 scripts/sfx_report.py [--sfx public/kit/sfx] [--out dist/sfx-report] [--thresholds FILE] [--strict]
        --strict exits 1 when any sound is flagged. Deterministic: no timestamps, fixed ordering.
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy import ndimage, signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
# Same level / loudness definitions as the generator, so the numbers agree with manifest.json.
from kit_make_sfx import FAMILIES, active_rms_db, lufs_estimate  # noqa: E402

BANDS = (("lt300", 0, 300), ("300_2k", 300, 2000), ("2k_5k", 2000, 5000), ("gt5k", 5000, None))
SPEC_DB = (-100.0, 0.0)  # shared colour scale (0 dB = full-scale sine)
SPEC_HZ = (50.0, 20000.0)  # shared log frequency axis
FLAG_ORDER = ("click", "too-harsh", "too-thin", "too-long", "too-quiet", "too-loud", "inconsistent")
# Click detector (HF energy spikes). A discontinuity (a note cut while still audible, a clipped buffer end) puts a short burst
# of broadband energy above 8 kHz into a sound whose own HF content is smooth.
CLICK_HP_HZ = 8000.0
CLICK_WINDOW_MS = 2.0
CLICK_HOP_MS = 0.5
CLICK_CONTEXT_MS = 20.0  # the "local envelope" is the median of the window levels within +-20 ms
CLICK_FLOOR_DB = -90.0  # ignore spikes whose own level is below this (dBFS RMS in the window): nothing audible
MID_BAND = (150.0, 500.0)  # the "knock" region: how much of a sound lives where phone speakers can reproduce it


def read_wav(path):
    """Mono float array in [-1, 1) plus the count of samples sitting at digital full scale."""
    sr, data = wavfile.read(path)
    if data.ndim != 1:
        raise SystemExit(f"{path}: expected a mono file")
    if data.dtype.kind == "i":
        full = float(2 ** (8 * data.dtype.itemsize - 1))
        # 24-bit PCM arrives left-justified in int32, so the largest positive value is 0x7FFFFF00.
        top = np.iinfo(data.dtype).max - (255 if data.dtype.itemsize == 4 else 0)
        clipped = int(np.sum((data >= top) | (data <= np.iinfo(data.dtype).min)))
        return sr, data.astype(np.float64) / full, clipped
    if data.dtype.kind != "f":
        raise SystemExit(f"{path}: unsupported sample type {data.dtype} (use signed PCM or float)")
    x = data.astype(np.float64)
    return sr, x, int(np.sum(np.abs(x) >= 1.0))


def envelope(x, sr):
    """Amplitude envelope: magnitude of the analytic signal, smoothed over 1 ms."""
    pad = int(0.05 * sr)
    mag = np.abs(signal.hilbert(np.pad(x, pad)))[pad : pad + len(x)]
    n = max(1, int(round(0.001 * sr)))
    return np.convolve(mag, np.ones(n) / n, mode="same")


def find_clicks(x, sr, spike_db=25.0):
    """
    Times (s) of >8 kHz energy spikes more than `spike_db` above the local envelope inside a 2 ms window.
    The high-passed signal is cut into 2 ms windows every 0.5 ms; each window's RMS is compared with the median RMS of the
    windows within +-20 ms. Neighbouring hits are merged into one click.
    """
    sos = signal.butter(4, CLICK_HP_HZ, btype="high", fs=sr, output="sos")
    hp = signal.sosfiltfilt(sos, x)
    win, hop = int(round(CLICK_WINDOW_MS * 1e-3 * sr)), int(round(CLICK_HOP_MS * 1e-3 * sr))
    if len(hp) < win + hop:
        return []
    csum = np.concatenate([[0.0], np.cumsum(hp**2)])
    starts = np.arange(0, len(hp) - win + 1, hop)
    rms = np.sqrt((csum[starts + win] - csum[starts]) / win)
    ctx = 2 * int(round(CLICK_CONTEXT_MS / CLICK_HOP_MS)) + 1
    local = ndimage.median_filter(rms, size=ctx, mode="nearest")
    ratio_db = 20 * np.log10(np.maximum(rms, 1e-12) / np.maximum(local, 1e-12))
    level_db = 20 * np.log10(np.maximum(rms, 1e-12))
    hits = np.nonzero((ratio_db > spike_db) & (level_db > CLICK_FLOOR_DB))[0]
    clicks, last = [], -10**9
    for k in hits:
        if k - last > ctx // 4:  # a new click, not the tail of the previous one
            clicks.append(round(float((starts[k] + win / 2) / sr), 4))
        last = k
    return clicks


def measure(x, sr, clipped):
    peak = float(np.max(np.abs(x)))
    if peak <= 0:
        raise SystemExit("silent file")
    peak_db = 20 * np.log10(peak)
    rms_db = float(active_rms_db(x))
    env = envelope(x, sr)
    top = int(np.argmax(env))
    t10 = int(np.argmax(env >= 0.1 * env[top]))
    t90 = int(np.argmax(env >= 0.9 * env[top]))
    above = np.nonzero(env >= env[top] * 10 ** (-40 / 20))[0]
    n = max(len(x), 1 << 16)  # zero-pad so very short files still resolve the 300 Hz band edge
    power = np.abs(np.fft.rfft(x, n)) ** 2
    freq = np.fft.rfftfreq(n, 1 / sr)
    total = float(np.sum(power))
    centroid = float(np.sum(freq * power) / total)
    bandwidth = float(np.sqrt(np.sum((freq - centroid) ** 2 * power) / total))
    shares = {k: float(np.sum(power[(freq >= lo) & (freq < (hi or sr))]) / total) for k, lo, hi in BANDS}
    mid_share = float(np.sum(power[(freq >= MID_BAND[0]) & (freq < MID_BAND[1])]) / total)
    fade_guard = int(round(0.012 * sr))  # just before the final 10 ms fade
    end_db = 20 * np.log10(max(float(np.max(env[max(0, len(x) - fade_guard - int(0.002 * sr)) : max(1, len(x) - fade_guard)])), 1e-9) / env[top])
    return {
        "duration_s": round(len(x) / sr, 4),
        "peak_dbfs": round(float(peak_db), 2),
        "active_rms_db": round(rms_db, 2),
        # kit_make_sfx's K-weighting uses 48 kHz coefficients, which is what the generator writes.
        "lufs_est": round(float(lufs_estimate(x)), 2),
        "crest_db": round(float(peak_db - rms_db), 2),
        "attack_ms": round((t90 - t10) / sr * 1000, 2),
        "tail_s": round(float(above[-1] - top) / sr, 4),
        "centroid_hz": round(centroid, 1),
        "bandwidth_hz": round(bandwidth, 1),
        "band_share": {k: round(v, 4) for k, v in shares.items()},
        "mid_150_500_share": round(mid_share, 4),
        "end_db": round(float(end_db), 1),
        "clicks": find_clicks(x, sr),
        "clipped_samples": clipped,
    }


def limits_for(cfg, family):
    return {**cfg["defaults"], **cfg.get("families", {}).get(family, {})}


def over(value, limit):
    return limit is not None and value > limit


def under(value, limit):
    return limit is not None and value < limit


def flag_sound(m, t):
    """List of {flag, reason} for one sound. A null limit switches its test off."""
    out = []

    def add(flag, reason):
        out.append({"flag": flag, "reason": reason})

    if over(len(m["clicks"]), t.get("clicks_max", 0)):
        add("click", f"{len(m['clicks'])} spike(s) above 8 kHz at {', '.join(f'{c * 1000:.1f} ms' for c in m['clicks'])}")

    bright = []
    if over(m["band_share"]["2k_5k"], t["share_2k_5k_max"]):
        bright.append(f"2-5 kHz share {m['band_share']['2k_5k']:.0%} > {t['share_2k_5k_max']:.0%}")
    if over(m["centroid_hz"], t["centroid_hz_max"]):
        bright.append(f"centroid {m['centroid_hz']:.0f} Hz > {t['centroid_hz_max']:.0f} Hz")
    fast = t["harsh_attack_ms_max"] is None or m["attack_ms"] <= t["harsh_attack_ms_max"]
    peaky = t["harsh_crest_db_min"] is None or m["crest_db"] >= t["harsh_crest_db_min"]
    if bright and fast and peaky:
        add("too-harsh", f"{'; '.join(bright)}; attack {m['attack_ms']:.1f} ms, crest {m['crest_db']:.1f} dB")

    if under(m["band_share"]["lt300"], t["low_share_min"]):
        add("too-thin", f"<300 Hz share {m['band_share']['lt300']:.1%} < {t['low_share_min']:.1%}")
    if under(m["bandwidth_hz"], t["bandwidth_hz_min"]):
        add("too-thin", f"bandwidth {m['bandwidth_hz']:.0f} Hz < {t['bandwidth_hz_min']:.0f} Hz")

    if over(m["duration_s"], t["duration_s_max"]):
        add("too-long", f"duration {m['duration_s']:.3f} s > {t['duration_s_max']} s")
    if over(m["tail_s"], t["tail_s_max"]):
        add("too-long", f"-40 dB tail {m['tail_s']:.3f} s > {t['tail_s_max']} s")

    if t["rms_target_db"] is not None and t["rms_tolerance_db"] is not None:
        diff = m["active_rms_db"] - t["rms_target_db"]
        if abs(diff) > t["rms_tolerance_db"]:
            add("too-loud" if diff > 0 else "too-quiet", f"active RMS {m['active_rms_db']:.1f} dB is {diff:+.1f} dB from target {t['rms_target_db']} dB")
    if over(m["peak_dbfs"], t["peak_dbfs_max"]):
        add("too-loud", f"peak {m['peak_dbfs']:.2f} dBFS > {t['peak_dbfs_max']} dBFS")
    if under(m["peak_dbfs"], t["peak_dbfs_min"]):
        add("too-quiet", f"peak {m['peak_dbfs']:.2f} dBFS < {t['peak_dbfs_min']} dBFS")
    if over(m["clipped_samples"], t["clip_samples_max"]):
        add("too-loud", f"{m['clipped_samples']} clipped samples")
    return out


def flag_families(sounds, cfg):
    """Adds 'inconsistent' to every variant of a family whose variants spread too far apart; returns per-family spreads."""
    families = {}
    for s in sounds:
        families.setdefault(s["family"], []).append(s)
    result = {}
    for name, items in families.items():
        t = limits_for(cfg, name)
        lufs = [s["metrics"]["lufs_est"] for s in items]
        cent = [s["metrics"]["centroid_hz"] for s in items]
        d_lufs = max(lufs) - min(lufs)
        d_cent = (max(cent) - min(cent)) / float(np.median(cent))
        reasons = []
        if over(d_lufs, t["variant_lufs_spread_max"]):
            reasons.append(f"loudness spread {d_lufs:.2f} LU > {t['variant_lufs_spread_max']} LU")
        if over(d_cent, t["variant_centroid_spread_max"]):
            reasons.append(f"centroid spread {d_cent:.1%} > {t['variant_centroid_spread_max']:.0%}")
        for s in items:
            s["flags"] += [{"flag": "inconsistent", "reason": r} for r in reasons]
        result[name] = {"lufs_spread": round(d_lufs, 2), "centroid_spread": round(d_cent, 3), "variants": len(items)}
    return result


def family_defaults():
    """gainDb / priority per family, read from families.ts for context in the report (empty if the format changes)."""
    src = (ROOT / "src/kit/audio/families.ts").read_text()
    found = re.findall(r"^\s*'?([a-z-]+)'?: \{gainDb: (-?[\d.]+), priority: (\d+)\}", src, re.M)
    return {n: {"gain_db": float(g), "priority": int(p)} for n, g, p in found}


def draw_spectrogram(ax, x, sr):
    nper, hop = 1024 if len(x) > sr // 10 else 256, 64
    win = np.hanning(nper)
    padded = np.pad(x, (nper // 2, nper // 2))
    frames = np.lib.stride_tricks.sliding_window_view(padded, nper)[::hop]
    mag = np.abs(np.fft.rfft(frames * win, 4096, axis=1)) / (win.sum() / 2)
    db = 20 * np.log10(np.maximum(mag, 1e-9))
    freq = np.fft.rfftfreq(4096, 1 / sr)
    keep = (freq >= SPEC_HZ[0] * 0.9) & (freq <= SPEC_HZ[1] * 1.05)
    t = np.arange(len(frames)) * hop / sr
    mesh = ax.pcolormesh(t, freq[keep], db[:, keep].T, shading="nearest", cmap="magma", vmin=SPEC_DB[0], vmax=SPEC_DB[1])
    ax.set_yscale("log")
    ax.set_ylim(*SPEC_HZ)
    ax.set_yticks([100, 300, 2000, 5000, 20000], ["100", "300", "2k", "5k", "20k"])
    ax.minorticks_off()
    ax.set_xlim(0, len(x) / sr)
    return mesh


def save_png(fig, path, dpi):
    fig.savefig(path, dpi=dpi, metadata={"Software": None})
    plt.close(fig)


def render_images(sounds, audio, out):
    spec_dir = out / "spectrograms"
    spec_dir.mkdir(parents=True, exist_ok=True)
    for s in sounds:
        fig, ax = plt.subplots(figsize=(5.0, 2.8), layout="constrained")
        mesh = draw_spectrogram(ax, *audio[s["name"]])
        ax.set(title=f"{s['name']}  ({s['metrics']['duration_s']:.3f} s)", xlabel="s", ylabel="Hz")
        fig.colorbar(mesh, ax=ax, label="dBFS")
        save_png(fig, spec_dir / f"{s['name']}.png", 100)

    families = list(dict.fromkeys(s["family"] for s in sounds))
    cols = max(sum(s["family"] == f for s in sounds) for f in families)
    fig, axes = plt.subplots(len(families), cols, figsize=(4.2 * cols, 1.8 * len(families) + 0.8), layout="constrained", squeeze=False)
    mesh = None
    for row, family in enumerate(families):
        items = [s for s in sounds if s["family"] == family]
        longest = max(s["metrics"]["duration_s"] for s in items)
        for col in range(cols):
            ax = axes[row][col]
            if col >= len(items):
                ax.axis("off")
                continue
            s = items[col]
            mesh = draw_spectrogram(ax, *audio[s["name"]])
            ax.set_xlim(0, longest)  # variants of a family share one time axis
            ax.set_facecolor("black")
            flags = sorted({f["flag"] for f in s["flags"]}, key=FLAG_ORDER.index)
            ax.set_title(s["name"] + (f"  [{', '.join(flags)}]" if flags else ""), fontsize=10, color="#b00020" if flags else "black")
            ax.tick_params(labelsize=7)
    fig.suptitle(f"SFX spectrograms by family (log {SPEC_HZ[0]:.0f}-{SPEC_HZ[1]:.0f} Hz, {SPEC_DB[0]:.0f} to {SPEC_DB[1]:.0f} dBFS; x = seconds, shared per row)", fontsize=12)
    fig.colorbar(mesh, ax=axes, label="dBFS", shrink=0.3, aspect=40)
    save_png(fig, out / "contact-sheet.png", 100)


def markdown(report):
    s = report["summary"]
    lines = [
        "# SFX report",
        "",
        "Flags mark measurable differences from `scripts/sfx_report_thresholds.json`. They are not a verdict on how a sound",
        "feels; decide that by ear.",
        "",
        f"**{s['flagged']} of {s['sounds']} sounds flagged.** " + (", ".join(f"{k}: {v}" for k, v in s["by_flag"].items()) or "No flags."),
        "",
        "| sound | dur s | peak dBFS | active RMS | LUFS est | crest dB | attack ms | tail s | centroid Hz | <300 | 300-2k | 2k-5k | >5k | clips | flags |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    for x in report["sounds"]:
        m, b = x["metrics"], x["metrics"]["band_share"]
        flags = ", ".join(sorted({f["flag"] for f in x["flags"]}, key=FLAG_ORDER.index)) or "-"
        lines.append(
            f"| {x['name']} | {m['duration_s']:.3f} | {m['peak_dbfs']:.2f} | {m['active_rms_db']:.1f} | {m['lufs_est']:.1f} | {m['crest_db']:.1f} "
            f"| {m['attack_ms']:.1f} | {m['tail_s']:.3f} | {m['centroid_hz']:.0f} | {b['lt300']:.0%} | {b['300_2k']:.0%} | {b['2k_5k']:.0%} | {b['gt5k']:.0%} "
            f"| {m['clipped_samples']} | {flags} |"
        )
    flagged = [x for x in report["sounds"] if x["flags"]]
    if flagged:
        lines += ["", "## Why each sound is flagged", ""]
        lines += [f"- **{x['name']}** {f['flag']}: {f['reason']}" for x in flagged for f in x["flags"]]
    lines += ["", "LUFS is an ungated K-weighted estimate over the whole file (same function as the generator), for relative use only.", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="Measure the generated SFX and flag measurable issues.")
    ap.add_argument("--sfx", default=str(ROOT / "public/kit/sfx"))
    ap.add_argument("--out", default=str(ROOT / "dist/sfx-report"))
    ap.add_argument("--thresholds", default=str(ROOT / "scripts/sfx_report_thresholds.json"))
    ap.add_argument("--strict", action="store_true", help="exit 1 if any sound is flagged")
    args = ap.parse_args()
    cfg = json.loads(Path(args.thresholds).read_text())
    unknown = {k for f in cfg.get("families", {}).values() for k in f} - set(cfg["defaults"])
    if unknown:
        raise SystemExit(f"unknown threshold key(s): {', '.join(sorted(unknown))}")

    order = list(FAMILIES)

    def sort_key(p):
        family, _, variant = p.stem.rpartition("-")
        return (order.index(family) if family in order else len(order), family, int(variant) if variant.isdigit() else 0)

    files = sorted((p for p in Path(args.sfx).glob("*.wav") if "@" not in p.stem), key=sort_key)
    if not files:
        raise SystemExit(f"no mono WAVs in {args.sfx}")
    defaults = family_defaults()
    sounds, audio = [], {}
    for path in files:
        sr, x, clipped = read_wav(path)
        if sr != 48000:
            raise SystemExit(f"{path}: expected 48 kHz (the loudness filter is defined for it), got {sr}")
        family = path.stem.rpartition("-")[0]
        metrics = measure(x, sr, clipped)
        sounds.append({"name": path.stem, "family": family, "file": path.name, "metrics": metrics, "flags": flag_sound(metrics, limits_for(cfg, family))})
        audio[path.stem] = (x, sr)
    spreads = flag_families(sounds, cfg)
    for name, info in spreads.items():
        info.update(defaults.get(name, {}))

    by_flag = {f: sum(any(g["flag"] == f for g in s["flags"]) for s in sounds) for f in FLAG_ORDER}
    report = {
        "version": 1,
        "summary": {"sounds": len(sounds), "flagged": sum(bool(s["flags"]) for s in sounds), "by_flag": {k: v for k, v in by_flag.items() if v}},
        "families": spreads,
        "sounds": sounds,
    }
    out = Path(args.out)
    shutil.rmtree(out / "spectrograms", ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    render_images(sounds, audio, out)
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    (out / "report.md").write_text(markdown(report))
    print(f"{report['summary']['flagged']} of {len(sounds)} sounds flagged {report['summary']['by_flag'] or ''}")
    print(f"wrote {out}/report.json, report.md, contact-sheet.png, spectrograms/")
    if args.strict and report["summary"]["flagged"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
