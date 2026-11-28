// Scaffolds the CI files of a new video repo that uses this kit as a git submodule.
//   node scripts/kit_init.mjs <target-dir> [--tag reuse-v1] [--kit-url https://github.com/buildwith-manish/ios-motion-kit.git]
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!target) { console.error('usage: node scripts/kit_init.mjs <target-dir> [--tag <kit tag>] [--kit-url <url>]'); process.exit(2); }
const tag = opt('--tag', 'reuse-v1');
const kitUrl = opt('--kit-url', 'https://github.com/buildwith-manish/ios-motion-kit.git');
const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'video');
const dest = path.resolve(target);
mkdirSync(dest, {recursive: true});
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n)) : [path.join(dir, n)]));
let written = 0;
for (const f of walk(src)) {
  const rel = path.relative(src, f); const out = path.join(dest, rel);
  if (existsSync(out)) { console.log(`kept     ${rel}`); continue; }
  mkdirSync(path.dirname(out), {recursive: true});
  writeFileSync(out, readFileSync(f, 'utf8').replaceAll('__KIT_TAG__', tag)); written++;
  console.log(`created  ${rel}`);
}
const gm = path.join(dest, '.gitmodules');
if (!existsSync(gm)) writeFileSync(gm, `[submodule "kit"]\n\tpath = kit\n\turl = ${kitUrl}\n`);
console.log(`\n${written} file(s) written to ${dest}. The kit repo is private: three setup steps before the first run (details: docs/ci-reuse.md, "Private kit setup"):
  1. Kit repo -> Settings -> Actions -> General -> Access: "Accessible from repositories owned by the user" (workflows of your video repos can then call the kit's reusable workflows).
  2. github.com/settings/personal-access-tokens: new fine-grained token, repository access = ios-motion-kit only, permission Contents: Read-only.
  3. Video repo -> Settings -> Secrets and variables -> Actions: new secret KIT_TOKEN = that token (or: gh secret set KIT_TOKEN).
Then: git submodule add ${kitUrl} kit   (skip if .gitmodules already lists it)`);
