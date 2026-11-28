// Tiles PNG frames into one labelled sheet with sharp (installed with `npm install --no-save sharp` on first use).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SHARP = 'sharp'; // module name in a variable so nothing needs sharp's types or install up front
export const loadSharp = async (cwd) => {
  try { return (await import(SHARP)).default; } catch {
    console.log('sharp not found: npm install --no-save sharp');
    const r = spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', 'sharp'], {cwd, stdio: 'inherit', shell: process.platform === 'win32'});
    if (r.status !== 0) throw new Error('could not install sharp');
    return (await import(SHARP)).default;
  }
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** items: [{file, label}] (row-major). Writes `out` and returns {width, height}. */
export const tileSheet = async ({cwd, items, tileW, cols, out, gap = 16, bg = '#0b1426', text = '#e8eef7', aspect = 9 / 16}) => {
  const sharp = await loadSharp(cwd);
  const lost = items.filter((i) => !fs.existsSync(i.file));
  if (lost.length) throw new Error(`missing frames: ${lost.map((i) => path.basename(i.file)).join(', ')}`);
  const tileH = Math.round(tileW * aspect), labelH = Math.round(tileW * 0.1), cellH = tileH + labelH;
  const c = Math.min(cols, items.length), rows = Math.ceil(items.length / c);
  const width = gap + c * (tileW + gap), height = gap + rows * (cellH + gap);
  const parts = [];
  for (let i = 0; i < items.length; i++) {
    const left = gap + (i % c) * (tileW + gap), top = gap + Math.floor(i / c) * (cellH + gap);
    const img = await sharp(items[i].file).resize({width: tileW, height: tileH, fit: 'fill'}).png().toBuffer();
    const fs_ = Math.round(labelH * 0.62);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${labelH}"><text x="${tileW / 2}" y="${Math.round(labelH * 0.74)}" text-anchor="middle" fill="${text}" font-family="Arial, Helvetica, sans-serif" font-size="${fs_}">${esc(items[i].label)}</text></svg>`;
    parts.push({input: img, left, top}, {input: Buffer.from(svg), left, top: top + tileH});
  }
  fs.mkdirSync(path.dirname(out), {recursive: true});
  await sharp({create: {width, height, channels: 3, background: bg}}).composite(parts).png().toFile(out);
  return {width, height};
};
