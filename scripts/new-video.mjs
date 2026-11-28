#!/usr/bin/env node
// Scaffolds a new video repo that uses this kit as the `kit/` git submodule. No network, no git: it only writes files.
//   node scripts/new-video.mjs <dir> --name <name> [--tag reuse-v1] [--kit-url https://github.com/buildwith-manish/ios-motion-kit.git]
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const name = opt('--name');
const usage = 'usage: node scripts/new-video.mjs <dir> --name <name> [--tag <kit tag>] [--kit-url <url>]';
if (!target || !name) { console.error(usage); process.exit(2); }
if (!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(name)) { console.error('--name must start with a letter and use letters, digits, spaces, "-" or "_"'); process.exit(2); }
const tag = opt('--tag', 'reuse-v1');
const kitUrl = opt('--kit-url', 'https://github.com/buildwith-manish/ios-motion-kit.git');
const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.join(here, '..');
const src = path.join(kitRoot, 'templates', 'video');
const dest = path.resolve(target);

const words = name.split(/[\s_-]+/).filter(Boolean);
const slug = words.map((w) => w.toLowerCase()).join('-');
const comp = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('-'); // Remotion composition id
const fill = (text) => text.replaceAll('__NAME__', name).replaceAll('__SLUG__', slug).replaceAll('__COMP__', comp).replaceAll('__KIT_TAG__', tag).replaceAll('__KIT_URL__', kitUrl).replaceAll('My-Video', comp);

mkdirSync(dest, {recursive: true});
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n)) : [path.join(dir, n)]));
let written = 0;
const write = (rel, content) => {
  const out = path.join(dest, rel);
  if (existsSync(out)) { console.log(`kept     ${rel}`); return; }
  mkdirSync(path.dirname(out), {recursive: true});
  writeFileSync(out, content); written++;
  console.log(`created  ${rel}`);
};

// Every template file (workflows, config, src, docs, public/.gitkeep). Fonts and brand assets are never templates.
for (const f of walk(src)) write(path.relative(src, f), fill(readFileSync(f, 'utf8')));

// package.json: Remotion and everything the kit imports, pinned to the kit's own versions; kit tools run from kit/scripts.
const kitPkg = JSON.parse(readFileSync(path.join(kitRoot, 'package.json'), 'utf8'));
const types = Object.fromEntries(Object.entries(kitPkg.devDependencies ?? {}).filter(([k]) => k === 'typescript' || k.startsWith('@types/')));
const toolScripts = Object.fromEntries(Object.entries(kitPkg.scripts ?? {})
  .filter(([k, v]) => k.startsWith('kit:') && /scripts\/(pipeline\/|kit_(fetch_data|data_check|data_manifest|layout_lint))/.test(v))
  .map(([k, v]) => [k, v.replaceAll('scripts/', 'kit/scripts/')]));
const pkg = {
  name: slug,
  version: '0.1.0',
  private: true,
  scripts: {
    dev: 'remotion studio src/index.ts --port=3000 --ipv4 --no-open',
    typecheck: 'tsc --noEmit',
    still: `remotion still src/index.ts ${comp} out/still.png --frame=60`,
    render: `remotion render src/index.ts ${comp} out/video.mp4`,
    ...toolScripts,
  },
  dependencies: kitPkg.dependencies,
  devDependencies: types,
};
write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`\n${written} file(s) written to ${dest}. Not done for you (no network here): add the kit submodule:
  cd ${target} && git init && git submodule add ${kitUrl} kit
The kit repo is private: three setup steps before the first CI run (details: kit/docs/ci-reuse.md, "Private kit setup"):
  1. Kit repo -> Settings -> Actions -> General -> Access: "Accessible from repositories owned by the user" (workflows of your video repos can then call the kit's reusable workflows).
  2. github.com/settings/personal-access-tokens: new fine-grained token, repository access = ios-motion-kit only, permission Contents: Read-only.
  3. Video repo -> Settings -> Secrets and variables -> Actions: new secret KIT_TOKEN = that token (or: gh secret set KIT_TOKEN).
Then: npm install && npm run dev   (composition ${comp})`);
