// Shared plumbing for scripts/kit_*.mjs: CLI args, browser lookup, bundling, composition selection, loading src/kit/qa.
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Remotion can throw outside its own promises (for example when a composition's web font cannot be fetched).
// Without this the process dies with a bare stack and exit code 1, which here means "checks found problems".
for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, (e) => {
    const message = e?.message ?? String(e);
    console.error(`\ncould not run: ${message}`);
    if (/network|ERR_NAME_NOT_RESOLVED|fetch/i.test(message)) console.error('A composition (or the browser) could not load something from the network, such as a web font. Check the connection, or use an --entry that needs no network.');
    process.exit(2);
  });
}

export const DEFAULT_ENTRY = 'src/kit/demo/entry.tsx';
export const DEFAULT_OUT = 'out/kit-qa';
export const CHROMIUM_OPTIONS = {gl: 'swangle'};

/** `--key value`, `--key=value`, `--flag`. Anything not in `spec` is an error, so typos never pass silently. */
export const parseArgs = (spec, usage, argv = process.argv.slice(2)) => {
  const all = {help: 'flag', ...spec};
  const out = {_: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = a.slice(2, eq < 0 ? undefined : eq);
    const type = all[key];
    if (!type) fail(`unknown option --${key}\n${usage}`);
    if (type === 'flag') { out[key] = true; continue; }
    const raw = eq >= 0 ? a.slice(eq + 1) : argv[++i];
    if (raw === undefined || raw === '') fail(`--${key} needs a value`);
    if (type === 'number') {
      out[key] = Number(raw);
      if (!Number.isFinite(out[key])) fail(`--${key} must be a number, got "${raw}"`);
    } else out[key] = raw;
  }
  if (out.help) { console.log(usage); process.exit(0); }
  return out;
};

/** Exit code 2 = the script could not run (1 is reserved for "checks found problems"). */
export const fail = (message) => { console.error(message); process.exit(2); };

const findPreinstalled = () => {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) {
    for (const rel of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell']) {
      const p = path.join(root, dir, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
};

const sparticuz = async () => {
  let mod;
  try { mod = await import('@sparticuz/chromium'); } catch { return null; }
  // The package extracts to /tmp/chromium; its shared libraries land under /tmp.
  const p = await (mod.default ?? mod).executablePath();
  process.env.LD_LIBRARY_PATH = ['/tmp', '/tmp/al2/lib', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  return p;
};

/**
 * Remotion's own browser (found, or downloaded on first use). Runs in a child process because in 4.0.250 a blocked
 * download throws outside the promise and would kill this script before any fallback could run.
 */
const remotionBrowser = () => {
  if (process.env.KIT_NO_DOWNLOAD) return null;
  const code = "require('@remotion/renderer').ensureBrowser({logLevel:'error'}).then((s)=>{console.log('KIT_BROWSER='+(s.path||''));process.exit(0)})";
  const run = spawnSync(process.execPath, ['-e', code], {encoding: 'utf8', timeout: 300000});
  const found = /KIT_BROWSER=(.+)/.exec(run.stdout ?? '')?.[1]?.trim();
  if (run.status === 0 && found && existsSync(found)) return found;
  console.warn("Remotion's browser is unavailable here, trying fallbacks");
  return null;
};

let browserPromise = null;
/** Order: KIT_CHROME, Remotion's own browser, a Playwright headless shell, @sparticuz/chromium. */
export const resolveBrowser = () => (browserPromise ??= (async () => {
  const env = process.env.KIT_CHROME;
  if (env) {
    if (!existsSync(env)) fail(`KIT_CHROME does not exist: ${env}`);
    return {executable: env, source: 'KIT_CHROME'};
  }
  const remotion = remotionBrowser();
  if (remotion) return {executable: remotion, source: 'remotion'};
  const pre = findPreinstalled();
  if (pre) return {executable: pre, source: 'playwright'};
  const sp = await sparticuz();
  if (sp) return {executable: sp, source: '@sparticuz/chromium'};
  return fail('No browser found. Set KIT_CHROME=/path/to/chrome, or: npm i --no-save @sparticuz/chromium');
})());

export const remotionBrowserOptions = async () => ({
  browserExecutable: (await resolveBrowser()).executable,
  chromiumOptions: CHROMIUM_OPTIONS,
  logLevel: 'error',
});

export const openRemotionBrowser = async () => openBrowser('chrome', await remotionBrowserOptions());

/** Bundles an entry point once. `--serve-url <dir>` reuses an existing bundle directory. */
export const getBundle = async ({entry = DEFAULT_ENTRY, serveUrl} = {}) => {
  if (serveUrl) return path.resolve(serveUrl);
  if (!existsSync(entry)) fail(`entry not found: ${entry}`);
  console.log(`bundling ${entry} ...`);
  return bundle({entryPoint: path.resolve(entry)});
};

export const parseProps = (raw) => {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return fail(`--props is not valid JSON: ${e.message}`); }
};

/** `--comp A,B` or `--all`. Unknown ids are an error that lists what exists. */
export const pickCompositions = async ({serveUrl, comp, all, inputProps = {}, puppeteerInstance}) => {
  const list = await getCompositions(serveUrl, {...(await remotionBrowserOptions()), inputProps, puppeteerInstance});
  if (all) return list;
  if (!comp) return fail(`pass --comp <id[,id]> or --all. Available:\n  ${list.map((c) => c.id).join('\n  ')}`);
  return comp.split(',').map((id) => list.find((c) => c.id === id) ?? fail(`no composition "${id}". Available:\n  ${list.map((c) => c.id).join('\n  ')}`));
};

/** Compiles TypeScript from src/kit for Node, so scripts and demos share one implementation of every rule. */
export const loadKit = async (modulePath = 'src/kit/qa/index.ts') => {
  const dir = mkdtempSync(path.join(process.cwd(), 'node_modules', '.kit-qa-'));
  const outfile = path.join(dir, 'kit.mjs');
  try {
    await build({entryPoints: [path.resolve(modulePath)], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error', external: ['react', 'react-dom', 'remotion']});
    return await import(pathToFileURL(outfile).href);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
};

export const ensureDir = (dir) => { mkdirSync(dir, {recursive: true}); return dir; };

/** playwright-core (devDependency) drives the same browser binary Remotion uses. */
export const launchPlaywright = async () => {
  const require = createRequire(import.meta.url);
  const {chromium} = require('playwright-core');
  const {executable} = await resolveBrowser();
  return chromium.launch({executablePath: executable, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']});
};

/** In-place progress line on a terminal; silent when piped (CI logs would otherwise get one entry per frame). */
export const progress = (text) => { if (process.stdout.isTTY) process.stdout.write(`\r${text}`); };
/** Final line for a progress run. */
export const progressDone = (text) => console.log(`${process.stdout.isTTY ? '\r' : ''}${text}`);
