/**
 * Checks the choropleth class colours for colour-vision deficiency (Machado 2009, severity 1.0) in every theme.
 *   npx esbuild scripts/map_check_scales.ts --bundle --platform=node | node
 * Reports the smallest OKLab distance (x100) between neighbouring classes and between any two classes, and for
 * sequential scales whether lightness is strictly monotonic. Exits 1 on a failure.
 */
import {themes} from '../src/kit/tokens/themes';
import {makeColorScale, oklab} from '../src/kit/map/colorScale';

const M: Record<string, number[][] | null> = {
  normal: null,
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const unlin = (x: number) => Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
const sim = (hex: string, m: number[][] | null) => {
  if (!m) return hex;
  const c = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return `#${m.map((r) => Math.round(unlin(r[0] * c[0] + r[1] * c[1] + r[2] * c[2]) * 255).toString(16).padStart(2, '0')).join('')}`;
};
const dist = (a: string, b: string) => { const x = oklab(a), y = oklab(b); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
/** Threshold: about 4x a just-noticeable difference in OKLab x100. */
const MIN = 8;
let failed = false;
for (const theme of Object.values(themes)) for (const type of ['sequential', 'diverging'] as const) {
  const colors = makeColorScale(theme, {type, domain: type === 'diverging' ? [-1, 0, 1] : [0, 1]}).classes.map((c) => c.color);
  for (const [vision, m] of Object.entries(M)) {
    const s = colors.map((c) => sim(c, m));
    let adj = Infinity, any = Infinity;
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const d = dist(s[i], s[j]); any = Math.min(any, d); if (j === i + 1) adj = Math.min(adj, d); }
    const L = s.map((c) => oklab(c)[0]);
    const mono = L.every((v, i) => !i || v > L[i - 1]) || L.every((v, i) => !i || v < L[i - 1]);
    const ok = any >= MIN && (type === 'diverging' || mono);
    failed ||= !ok;
    console.log(`${theme.name.padEnd(8)} ${type.padEnd(10)} ${vision.padEnd(6)} adjacent ${adj.toFixed(1).padStart(5)}  any pair ${any.toFixed(1).padStart(5)}  ${type === 'sequential' ? `lightness monotonic ${mono}` : ''}  ${ok ? 'ok' : 'FAIL'}`);
  }
  console.log(`  ${colors.join(' ')}`);
}
process.exit(failed ? 1 : 0);
