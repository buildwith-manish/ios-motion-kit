"""Shared helpers for the pipeline tools: config loading (defaults + schema validation), paths, wav reading, ffmpeg decode."""
import argparse, json, os, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def _merge(base, over):
    out = dict(base)
    for k, v in over.items():
        out[k] = _merge(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return out


_T = {'object': dict, 'array': list, 'string': str, 'boolean': bool, 'null': type(None)}


def _type_ok(v, t):
    if t == 'number': return isinstance(v, (int, float)) and not isinstance(v, bool)
    if t == 'integer': return isinstance(v, int) and not isinstance(v, bool)
    return isinstance(v, _T[t])


def validate(v, s, path='config'):
    """Subset of JSON Schema: type, properties, required, additionalProperties, items, minItems, minLength, minimum, enum."""
    errs = []
    ts = s.get('type')
    if ts is not None:
        ts = ts if isinstance(ts, list) else [ts]
        if not any(_type_ok(v, t) for t in ts):
            return [f"{path}: expected {'/'.join(ts)}, got {type(v).__name__}"]
    if 'enum' in s and v not in s['enum']: errs.append(f"{path}: must be one of {s['enum']}")
    if isinstance(v, (int, float)) and not isinstance(v, bool) and 'minimum' in s and v < s['minimum']: errs.append(f"{path}: must be >= {s['minimum']}")
    if isinstance(v, str) and len(v) < s.get('minLength', 0): errs.append(f'{path}: must not be empty')
    if isinstance(v, dict):
        for k in s.get('required', []):
            if k not in v: errs.append(f'{path}.{k}: required')
        for k, x in v.items():
            if k in s.get('properties', {}): errs += validate(x, s['properties'][k], f'{path}.{k}')
            elif s.get('additionalProperties') is False: errs.append(f'{path}.{k}: unknown key')
    if isinstance(v, list):
        if len(v) < s.get('minItems', 0): errs.append(f"{path}: needs at least {s['minItems']} item(s)")
        for i, x in enumerate(v):
            if 'items' in s: errs += validate(x, s['items'], f'{path}[{i}]')
    return errs


def load_config(root, config=None):
    path = config or os.path.join(root, 'video.config.json')
    user = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    if not os.path.exists(path): print(f'note: {path} not found, using defaults', file=sys.stderr)
    errs = validate(user, json.load(open(os.path.join(HERE, 'video.config.schema.json'))))
    if errs: sys.exit('invalid video.config.json:\n  ' + '\n  '.join(errs))
    cfg = _merge(json.load(open(os.path.join(HERE, 'config.defaults.json'))), user)
    if 'maxShot' in cfg['shot'] and cfg['shot']['maxShot'] <= 0: sys.exit('shot.maxShot must be > 0')
    return cfg


def parse(desc, extra=None, argv=None):
    p = argparse.ArgumentParser(description=desc)
    p.add_argument('--root', default='.', help='the consuming repo (default: current directory)')
    p.add_argument('--config', default=None, help='config file (default: <root>/video.config.json)')
    if extra: extra(p)
    a = p.parse_args(argv)
    root = os.path.abspath(a.root)
    return a, root, load_config(root, a.config)


def read_wav(path):
    """(mono float32 in -1..1, sample rate) of a 16-bit PCM wav."""
    w = wave.open(path)
    sr, ch = w.getframerate(), w.getnchannels()
    d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return (d.reshape(-1, ch).mean(1) if ch > 1 else d), sr


def decode(path, sr):
    """Mono float32 at `sr`. PCM wavs at that rate are read directly, anything else goes through ffmpeg."""
    if path.lower().endswith('.wav'):
        try:
            d, r = read_wav(path)
            if r == sr: return d
        except (wave.Error, EOFError): pass
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<f4')


def read_lines(path):
    """Script lines: CSV with id,text columns, a JSON array of {id,text}, or plain text (one line per spoken line, ids l01, l02, ...)."""
    import csv
    if path.endswith('.json'): return [dict(id=str(r['id']), text=r['text']) for r in json.load(open(path, encoding='utf-8'))]
    if path.endswith('.csv'): return list(csv.DictReader(open(path, newline='', encoding='utf-8')))
    rows = [l.strip() for l in open(path, encoding='utf-8') if l.strip() and not l.startswith('#')]
    return [dict(id=f'l{i:02d}', text=t) for i, t in enumerate(rows, 1)]


def rel(root, p): return os.path.join(root, p)
