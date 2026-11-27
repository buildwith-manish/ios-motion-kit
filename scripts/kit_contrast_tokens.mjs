// Contrast check by maths only: one row per (theme, role, surface, backdrop). Exits 1 on any FAIL.
// Bundles the pure token files with esbuild (Remotion stubbed) so no rendering or browser is involved.
import {build} from 'esbuild';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'node_modules/.cache/kit-contrast');
mkdirSync(out, {recursive: true});
writeFileSync(resolve(out, 'entry.ts'), `export {themes} from '${resolve(root, 'src/kit/tokens/themes.ts')}'; export {contrastTable} from '${resolve(root, 'src/kit/tokens/contrast.ts')}';`);
await build({
  entryPoints: [resolve(out, 'entry.ts')], outfile: resolve(out, 'bundle.mjs'), bundle: true, format: 'esm', platform: 'node', logLevel: 'error',
  plugins: [{name: 'stub-remotion', setup: (b) => {
    b.onResolve({filter: /^remotion$/}, () => ({path: 'remotion', namespace: 'stub'}));
    b.onLoad({filter: /.*/, namespace: 'stub'}, () => ({contents: 'export const continueRender=()=>{};export const delayRender=()=>0;export const staticFile=(f)=>"/"+f;', loader: 'js'}));
  }}],
});
const {themes, contrastTable} = await import(pathToFileURL(resolve(out, 'bundle.mjs')).href);

const pad = (v, n) => String(v).padEnd(n);
let fails = 0;
console.log(`orbMaxAlpha: ${Object.keys(themes).map((n) => `${n} ${themes[n].colors.orbMaxAlpha}`).join(', ')}`);
console.log([pad('theme', 9), pad('role', 14), pad('surface', 7), pad('backdrop', 10), pad('fg', 8), pad('bg', 8), pad('ratio', 6), pad('req', 4), 'result'].join(' '));
for (const name of Object.keys(themes)) {
  for (const r of contrastTable(themes[name])) {
    if (!r.pass) fails++;
    console.log([pad(r.theme, 9), pad(r.role, 14), pad(r.surface, 7), pad(r.backdrop, 10), pad(r.fg, 8), pad(r.bg, 8), pad(r.ratio.toFixed(2), 6), pad(r.required, 4), r.pass ? 'PASS' : 'FAIL'].join(' '));
  }
}
console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL'}`);
process.exit(fails ? 1 : 0);
