// Shared helpers for the node pipeline tools: argument parsing, config loading (defaults + schema validation), script lines.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (base, over) => {
  const out = {...base};
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
};
const typeOk = (v, t) => (t === 'object' ? isObj(v) : t === 'array' ? Array.isArray(v) : t === 'null' ? v === null : t === 'integer' ? Number.isInteger(v) : t === 'number' ? typeof v === 'number' : typeof v === t);

/** Subset of JSON Schema: type, properties, required, additionalProperties, items, minItems, minLength, minimum, enum. Same rules as lib.py. */
export const validate = (v, s, p = 'config') => {
  const errs = [];
  if (s.type !== undefined) {
    const ts = [].concat(s.type);
    if (!ts.some((t) => typeOk(v, t))) return [`${p}: expected ${ts.join('/')}, got ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`];
  }
  if (s.enum && !s.enum.includes(v)) errs.push(`${p}: must be one of ${JSON.stringify(s.enum)}`);
  if (typeof v === 'number' && s.minimum !== undefined && v < s.minimum) errs.push(`${p}: must be >= ${s.minimum}`);
  if (typeof v === 'string' && v.length < (s.minLength ?? 0)) errs.push(`${p}: must not be empty`);
  if (isObj(v)) {
    for (const k of s.required ?? []) if (!(k in v)) errs.push(`${p}.${k}: required`);
    for (const [k, x] of Object.entries(v)) {
      if (s.properties?.[k]) errs.push(...validate(x, s.properties[k], `${p}.${k}`));
      else if (s.additionalProperties === false) errs.push(`${p}.${k}: unknown key`);
    }
  }
  if (Array.isArray(v)) {
    if (v.length < (s.minItems ?? 0)) errs.push(`${p}: needs at least ${s.minItems} item(s)`);
    if (s.items) v.forEach((x, i) => errs.push(...validate(x, s.items, `${p}[${i}]`)));
  }
  return errs;
};

export const fail = (msg, code = 1) => { console.error(msg); process.exit(code); };

/** `--root <dir> --config <file>` plus tool flags: `flags` maps name -> true (boolean) or 'value'. Returns {root, cfg, args, rest}. */
export const init = (argv = process.argv.slice(2), flags = {}) => {
  const args = {}; const rest = [];
  let root = '.', config = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.startsWith('--') ? a.indexOf('=') : -1;
    const name = a.startsWith('--') ? a.slice(2, eq > 0 ? eq : undefined) : null;
    if (name === 'root') root = eq > 0 ? a.slice(eq + 1) : argv[++i];
    else if (name === 'config') config = eq > 0 ? a.slice(eq + 1) : argv[++i];
    else if (name && flags[name] === true) args[name] = true;
    else if (name && flags[name] === 'value') args[name] = eq > 0 ? a.slice(eq + 1) : argv[++i];
    else if (name) fail(`unknown option --${name}`);
    else rest.push(a);
  }
  root = path.resolve(root);
  const file = config ? path.resolve(config) : path.join(root, 'video.config.json');
  const user = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (!fs.existsSync(file)) console.error(`note: ${file} not found, using defaults`);
  const errs = validate(user, JSON.parse(fs.readFileSync(path.join(HERE, 'video.config.schema.json'), 'utf8')));
  if (errs.length) fail(`invalid video.config.json:\n  ${errs.join('\n  ')}`);
  const cfg = merge(JSON.parse(fs.readFileSync(path.join(HERE, 'config.defaults.json'), 'utf8')), user);
  return {root, cfg, args, rest, at: (p) => path.join(root, p)};
};

export const parseCsv = (s) => {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...r] = rows;
  return r.filter((x) => x.length > 1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]])));
};

/** Script lines [{id, text}]: CSV (id,text), JSON array, or plain text (one line each, ids l01..). Same as lib.py. */
export const readLines = (file) => {
  const s = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) return JSON.parse(s).map((r) => ({id: String(r.id), text: r.text}));
  if (file.endsWith('.csv')) return parseCsv(s);
  return s.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((text, i) => ({id: `l${String(i + 1).padStart(2, '0')}`, text}));
};

export const readLayout = (root, cfg) => JSON.parse(fs.readFileSync(path.join(root, cfg.output.layout), 'utf8'));
