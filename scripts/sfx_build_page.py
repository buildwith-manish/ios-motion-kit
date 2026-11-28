#!/usr/bin/env python3
"""
sfx_build_page.py - turns dist/sfx-report/report.json into a static, dependency-free listening page.

Writes dist/sfx-report/index.html and copies the mono WAVs into dist/sfx-report/audio/, so the folder works on its own
(open index.html from disk, or serve it). Run scripts/sfx_report.py first.

Usage:  python3 scripts/sfx_build_page.py [--sfx public/kit/sfx] [--dir dist/sfx-report]
"""
import argparse
import json
import shutil
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CSS = """
:root{--bg:#f2f2f7;--card:#fff;--ink:#1c1c1e;--dim:#636366;--line:#d1d1d6;--accent:#0060df}
@media(prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--ink:#f2f2f7;--dim:#aeaeb2;--line:#38383a;--accent:#4da3ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 system-ui,-apple-system,sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}h1{font-size:24px;margin:8px 0}h2{font-size:19px;margin:0}
p{color:var(--dim);margin:6px 0}a{color:var(--accent)}
section{margin:24px 0}header{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-bottom:8px}header span{color:var(--dim);font-size:13px}
button{font:inherit;min-height:40px;padding:6px 14px;border-radius:20px;border:1px solid var(--accent);background:none;color:var(--accent);cursor:pointer}
button[aria-pressed=true]{background:var(--accent);color:var(--card)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))}
article{background:var(--card);border-radius:14px;padding:12px;border:2px solid transparent;min-width:0}article.playing{border-color:var(--accent)}
h3{font-size:15px;margin:0 0 6px}audio{width:100%;display:block}img{width:100%;height:auto;border-radius:8px;margin-top:8px;background:#fff}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0 0}dt{font-size:11px;color:var(--dim)}dd{margin:0;font-variant-numeric:tabular-nums;font-size:13px}
ul{list-style:none;padding:0;margin:8px 0 0}li{font-size:12px;color:var(--dim);margin-top:4px}
.badge{display:inline-block;border-radius:6px;padding:1px 7px;margin-right:6px;font-weight:600;font-size:12px;color:#fff}
.too-harsh{background:#c0182b}.too-thin{background:#8a4fbf}.too-long{background:#a35200}.too-quiet{background:#2563a8}.too-loud{background:#b3245f}
.inconsistent{background:#6b5d00}.none{background:#4f5358}
body.only-flagged article:not(.flagged),body.only-flagged section:not(.flagged){display:none}
"""

JS = """
(function(){
  var run = 0, timer = null, active = null, current = null;
  var players = Array.prototype.slice.call(document.querySelectorAll('audio'));
  function mark(a){ players.forEach(function(p){ p.closest('article').classList.toggle('playing', p === a); }); }
  function stop(keep){
    run++; clearTimeout(timer); current = null;
    if (active) { active.setAttribute('aria-pressed','false'); active.textContent = active.dataset.label; active = null; }
    players.forEach(function(p){ p.onended = null; if (p !== keep) p.pause(); });
    mark(keep || null);
  }
  document.querySelectorAll('button[data-family]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var same = active === btn; stop(); if (same) return;
      var list = Array.prototype.slice.call(btn.closest('section').querySelectorAll('audio')), id = run, i = 0;
      active = btn; btn.setAttribute('aria-pressed','true'); btn.textContent = 'Stop';
      (function next(){
        if (id !== run) return;
        if (i >= list.length) { stop(); return; }
        var a = list[i++]; current = a; a.currentTime = 0; mark(a);
        a.onended = function(){ a.onended = null; timer = setTimeout(next, 450); };
        var p = a.play(); if (p) p.catch(function(){ if (id === run) stop(); });
      })();
    });
  });
  players.forEach(function(a){
    a.addEventListener('play', function(){
      if (a.paused) return;
      if (active && a !== current) stop(a);
      players.forEach(function(p){ if (p !== a) p.pause(); });
      mark(a);
    });
    a.addEventListener('pause', function(){ if (active && a === current && !a.ended) stop(); });
    a.addEventListener('pointerdown', function(){ if (active) stop(); });
  });
  document.getElementById('only').addEventListener('change', function(e){ stop(); document.body.classList.toggle('only-flagged', e.target.checked); });
})();
"""


def card(s):
    m, b, name = s["metrics"], s["metrics"]["band_share"], escape(s["name"])
    badges = sorted({f["flag"] for f in s["flags"]})
    tags = "".join(f'<span class="badge {escape(f)}">{escape(f)}</span>' for f in badges) or '<span class="badge none">no flags</span>'
    reasons = "".join(f'<li><b>{escape(f["flag"])}</b>: {escape(f["reason"])}</li>' for f in s["flags"])
    items = [
        ("Duration", f"{m['duration_s']:.3f} s"), ("Peak", f"{m['peak_dbfs']:.2f} dBFS"), ("Active RMS", f"{m['active_rms_db']:.1f} dB"),
        ("LUFS est.", f"{m['lufs_est']:.1f}"), ("Crest", f"{m['crest_db']:.1f} dB"), ("Attack", f"{m['attack_ms']:.1f} ms"),
        ("-40 dB tail", f"{m['tail_s']:.3f} s"), ("Centroid", f"{m['centroid_hz']:.0f} Hz"), ("Bandwidth", f"{m['bandwidth_hz']:.0f} Hz"),
        ("&lt;300 / 300-2k", f"{b['lt300']:.0%} / {b['300_2k']:.0%}"), ("2-5k / &gt;5k", f"{b['2k_5k']:.0%} / {b['gt5k']:.0%}"), ("Clipped", str(m["clipped_samples"])),
    ]
    metrics = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in items)
    return (
        f'<article class="{"flagged" if s["flags"] else ""}"><h3>{name}</h3><div>{tags}</div>'
        f'<audio controls preload="metadata" src="audio/{escape(s["file"])}" aria-label="{name}"></audio>'
        f'<a href="spectrograms/{name}.png"><img loading="lazy" width="500" height="280" src="spectrograms/{name}.png" alt="Spectrogram of {name}"></a>'
        f"<dl>{metrics}</dl>{'<ul>' + reasons + '</ul>' if reasons else ''}</article>"
    )


def page(report):
    families = {}
    for s in report["sounds"]:
        families.setdefault(s["family"], []).append(s)
    sections = []
    for name, items in families.items():
        info = report["families"][name]
        mix = f"default gain {info['gain_db']:g} dB, priority {info['priority']} · " if "gain_db" in info else ""
        flagged = "flagged" if any(s["flags"] for s in items) else ""
        sections.append(
            f'<section class="{flagged}"><header><h2>{escape(name)}</h2>'
            f'<button type="button" data-family aria-pressed="false" data-label="Play all {len(items)} variants">Play all {len(items)} variants</button>'
            f"<span>{mix}loudness spread {info['lufs_spread']:.2f} LU, centroid spread {info['centroid_spread']:.0%}</span></header>"
            f'<div class="grid">{"".join(card(s) for s in items)}</div></section>'
        )
    summary = report["summary"]
    counts = "".join(f'<span class="badge {k}">{k}: {v}</span>' for k, v in summary["by_flag"].items())
    return (
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>SFX listening page</title><style>{CSS}</style></head><body><main>"
        f"<h1>SFX listening page</h1><p>{summary['flagged']} of {summary['sounds']} sounds flagged. Flags mark measurable differences from the "
        "thresholds file, not a verdict on how a sound feels: judge by ear. Files play at their -3 dBFS peak level, without the per-family mix gain.</p>"
        f'<p>{counts}</p><p><a href="contact-sheet.png">Contact sheet</a> · <a href="report.md">report.md</a> · <a href="report.json">report.json</a></p>'
        f'<p><label><input type="checkbox" id="only"> Show flagged sounds only</label></p>{"".join(sections)}</main><script>{JS}</script></body></html>\n'
    )


def main():
    ap = argparse.ArgumentParser(description="Build the static SFX listening page.")
    ap.add_argument("--sfx", default=str(ROOT / "public/kit/sfx"))
    ap.add_argument("--dir", default=str(ROOT / "dist/sfx-report"))
    args = ap.parse_args()
    out = Path(args.dir)
    if not (out / "report.json").is_file():
        raise SystemExit(f"{out}/report.json not found: run python3 scripts/sfx_report.py first")
    report = json.loads((out / "report.json").read_text())
    audio = out / "audio"
    shutil.rmtree(audio, ignore_errors=True)
    audio.mkdir(parents=True)
    for s in report["sounds"]:
        shutil.copyfile(Path(args.sfx) / s["file"], audio / s["file"])
    (out / "index.html").write_text(page(report))
    print(f"wrote {out}/index.html and {len(report['sounds'])} files in {out}/audio/")


if __name__ == "__main__":
    main()
