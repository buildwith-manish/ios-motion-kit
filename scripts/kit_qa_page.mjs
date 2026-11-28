// Drives a bundled composition in a real page (same protocol @remotion/renderer 4.0.250 uses), so checks can read
// the DOM and take the same frame with and without text. Remotion is pinned in package.json; re-test on upgrade.
// Limitation: <OffthreadVideo> needs Remotion's frame proxy, which this harness does not provide.
import {spawnSync} from 'node:child_process';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fail} from './kit_qa_common.mjs';

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm'};

/** Static server for a bundle directory, bound to localhost only. */
export const serveDir = async (dir) => {
  const root = path.resolve(dir);
  const server = createServer((req, res) => {
    let file = path.join(root, path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'});
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); })};
};

/** Opens one composition at 1:1 pixel size. Returns {page, seek(frame), close()}. */
export const openCompositionPage = async ({browser, url, composition, inputProps = {}, timeout = 120000}) => {
  const page = await browser.newPage({viewport: {width: composition.width, height: composition.height}, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(({input, timeoutMs}) => {
    Object.assign(window, {remotion_puppeteerTimeout: timeoutMs, remotion_inputProps: input, remotion_initialFrame: 0, remotion_attempt: 1, remotion_proxyPort: 0, remotion_audioEnabled: false, remotion_videoEnabled: true});
    window.process = window.process || {env: {}};
    window.process.env.NODE_ENV = 'production';
  }, {input: JSON.stringify(inputProps), timeoutMs: timeout});
  const ready = async () => {
    await page.waitForFunction(() => window.remotion_renderReady === true || window.remotion_cancelledError !== undefined, null, {timeout});
    const cancelled = await page.evaluate(() => window.remotion_cancelledError ?? null);
    if (cancelled || errors.length) fail(`${composition.id}: page error: ${cancelled ?? errors[0]}`);
  };
  await page.goto(url, {waitUntil: 'load', timeout});
  await page.waitForFunction(() => typeof window.remotion_setBundleMode === 'function', null, {timeout});
  await page.evaluate((c) => window.remotion_setBundleMode({type: 'composition', compositionName: c.id, serializedResolvedPropsWithSchema: JSON.stringify(c.props ?? {}), compositionDurationInFrames: c.durationInFrames, compositionFps: c.fps, compositionHeight: c.height, compositionWidth: c.width, compositionDefaultCodec: c.defaultCodec ?? null}), composition);
  await ready();
  return {
    page,
    async seek(frame) {
      await page.evaluate(({f, id}) => window.remotion_setFrame(f, id, 1), {f: frame, id: composition.id});
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await ready();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)));
      });
    },
    close: () => page.close(),
  };
};

/** Decodes a PNG buffer to packed rgb24. */
const decodePng = (png, width, height) => {
  const run = spawnSync('ffmpeg', ['-v', 'error', '-f', 'png_pipe', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], {input: png, maxBuffer: width * height * 3 + 1024});
  if (run.status !== 0 || run.stdout.length !== width * height * 3) fail(`ffmpeg could not decode a screenshot: ${run.error?.message ?? run.stderr}`);
  return run.stdout;
};

const HIDE_TEXT_CSS = `*,*::before,*::after{-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important;transition:none!important}
svg text,svg tspan,svg textPath{fill:transparent!important;stroke:transparent!important}`;

/** The current frame twice: as rendered, and with all text made transparent (the real background behind the text). */
export const captureFrame = async (page, {width, height}) => {
  const png = await page.screenshot({type: 'png'});
  await page.evaluate((css) => {
    const style = document.createElement('style');
    style.id = 'kit-qa-hide';
    style.textContent = css;
    document.head.appendChild(style);
    // Gradient-filled text paints through its background, so that has to go too.
    window.__kitQaRestore = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') {
        window.__kitQaRestore.push([el, el.style.visibility]);
        el.style.visibility = 'hidden';
      }
    }
  }, HIDE_TEXT_CSS);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const hidden = await page.screenshot({type: 'png'});
  await page.evaluate(() => {
    document.getElementById('kit-qa-hide')?.remove();
    for (const [el, v] of window.__kitQaRestore ?? []) el.style.visibility = v;
  });
  return {png, rgb: decodePng(png, width, height), background: decodePng(hidden, width, height)};
};

/**
 * Visible text runs and checkable elements of the current frame. Boxes are clipped by every overflow-clipping
 * ancestor (so hidden odometer digits and masked lines do not count). data-qa-ignore marks decoration.
 */
export const collectDom = (page) => page.evaluate(() => {
  const info = (el) => {
    let opacity = 1; let blur = 0; let ignored = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      const m = /blur\(([\d.]+)px\)/.exec(cs.filter || '');
      if (m) blur = Math.max(blur, Number(m[1]));
      if (n.hasAttribute('data-qa-ignore')) ignored = true;
    }
    return {opacity, blur, ignored};
  };
  const clip = (rect, el) => {
    let {left, top, right, bottom} = rect;
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (n instanceof SVGElement && !(n instanceof SVGSVGElement)) continue;
      const r = n.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { left = Math.max(left, r.left); right = Math.min(right, r.right); }
      if (cs.overflowY !== 'visible') { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
    }
    return right - left >= 1 && bottom - top >= 1 ? {left, top, right, bottom} : null;
  };
  const domPath = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) parts.push(`${n.localName}:${n.parentElement ? Array.prototype.indexOf.call(n.parentElement.children, n) : 0}`);
    return parts.reverse().join('/');
  };
  const texts = [];
  const byParent = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !node.textContent.trim() || el.closest('script,style,noscript,title,defs')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const full = [...range.getClientRects()];
    const rects = full.map((r) => clip(r, el)).filter(Boolean);
    if (!rects.length) continue;
    const area = (list) => list.reduce((sum, r) => sum + (r.right - r.left) * (r.bottom - r.top), 0);
    let entry = byParent.get(el);
    if (!entry) {
      const svg = el instanceof SVGElement;
      let size = parseFloat(cs.fontSize) || 0;
      // On-screen size: includes CSS transforms (camera zoom, scale-in) via the box height ratio.
      if (!svg && el.offsetHeight > 0) size *= el.getBoundingClientRect().height / el.offsetHeight || 1;
      const gradient = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
      // The label keeps the whitespace-only nodes that sit between words.
      const label = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      entry = {path: domPath(el), text: label, rects: [], fullArea: 0, shownArea: 0, color: svg ? cs.fill : cs.webkitTextFillColor || cs.color, gradient, fontSize: size, fontWeight: Number(cs.fontWeight) || 400, ...info(el)};
      byParent.set(el, entry);
      texts.push(entry);
    }
    entry.rects.push(...rects);
    entry.fullArea += area(full);
    entry.shownArea += area(rects);
  }
  const elements = [];
  const canvasArea = window.innerWidth * window.innerHeight;
  for (const el of document.querySelectorAll('[data-qa-safe],img,svg,video,canvas')) {
    const tagged = el.hasAttribute('data-qa-safe');
    if (!tagged && el.parentElement?.closest('svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const box = clip(el.getBoundingClientRect(), el.parentElement);
    if (!box) continue;
    // Untagged media that covers a quarter of the frame or more is treated as background art.
    if (!tagged && (box.right - box.left) * (box.bottom - box.top) >= canvasArea * 0.25) continue;
    elements.push({path: domPath(el), label: el.getAttribute('data-qa-safe') || `<${el.tagName.toLowerCase()}>`, tagged, box, ...info(el)});
  }
  // Word-by-word reveals put each word in its own wrapper; read the spaced label from the nearest line.
  for (const t of texts) t.visibleFraction = t.fullArea ? t.shownArea / t.fullArea : 0;
  for (const t of texts) t.text = t.text.replace(/\s+/g, ' ').trim();
  return {texts, elements};
});

/**
 * Tight box around the glyph pixels inside a text box: the pixels that change when text is hidden. Returns null when
 * nothing changes (covered, clipped by clip-path, same colour as the background, or colour emoji).
 * Font boxes are taller than the glyphs, so measuring them instead would flag text that is visibly inside.
 */
export const inkBox = (shot, rect, {width, height}) => {
  let left = Infinity; let top = Infinity; let right = -1; let bottom = -1; let changed = 0;
  for (let y = Math.max(0, Math.floor(rect.top)); y < Math.min(height, Math.ceil(rect.bottom)); y++) {
    for (let x = Math.max(0, Math.floor(rect.left)); x < Math.min(width, Math.ceil(rect.right)); x++) {
      const i = (y * width + x) * 3;
      if (Math.max(Math.abs(shot.rgb[i] - shot.background[i]), Math.abs(shot.rgb[i + 1] - shot.background[i + 1]), Math.abs(shot.rgb[i + 2] - shot.background[i + 2])) <= 4) continue;
      changed++;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return changed >= 6 ? {left, top, right: right + 1, bottom: bottom + 1} : null;
};

/** Every pixel inside the boxes that changes when text is hidden, as {shown, behind} pairs (see measureTextContrast). */
export const glyphPixels = (shot, rects, {width, height}) => {
  const seen = new Set();
  const out = [];
  for (const r of rects) {
    for (let y = Math.max(0, Math.floor(r.top)); y < Math.min(height, Math.ceil(r.bottom)); y++) {
      for (let x = Math.max(0, Math.floor(r.left)); x < Math.min(width, Math.ceil(r.right)); x++) {
        const i = (y * width + x) * 3;
        if (seen.has(i)) continue;
        seen.add(i);
        const shown = [shot.rgb[i], shot.rgb[i + 1], shot.rgb[i + 2]];
        const behind = [shot.background[i], shot.background[i + 1], shot.background[i + 2]];
        if (Math.max(Math.abs(shown[0] - behind[0]), Math.abs(shown[1] - behind[1]), Math.abs(shown[2] - behind[2])) > 4) out.push({shown, behind});
      }
    }
  }
  return out;
};

/** Saves the frame with boxes drawn on it. boxes: [{left, top, right, bottom, color, label}] */
export const saveAnnotated = async (browser, {png, width, height, boxes, file}) => {
  const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const divs = boxes.map((b) => `<div style="position:absolute;box-sizing:border-box;left:${b.left}px;top:${b.top}px;width:${b.right - b.left}px;height:${b.bottom - b.top}px;border:3px ${b.dashed ? 'dashed' : 'solid'} ${b.color}">${b.label ? `<span style="position:absolute;left:0;top:100%;background:${b.color};color:#000;font:600 18px system-ui,sans-serif;padding:1px 6px;white-space:nowrap">${esc(b.label)}</span>` : ''}</div>`).join('');
  await page.setContent(`<body style="margin:0;width:${width}px;height:${height}px;position:relative"><img src="data:image/png;base64,${png.toString('base64')}" style="display:block">${divs}</body>`, {waitUntil: 'load'});
  await page.screenshot({path: file});
  await page.close();
};

/**
 * Font state of the page for kit_font_check.mjs: every FontFace in document.fonts with its load status, and the
 * first family/weight of every element that directly holds text (HTML and SVG), with a count and a sample.
 */
export const collectFontState = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  const faces = [...document.fonts].map((f) => ({family: f.family.replace(/["']/g, ''), weight: String(f.weight), status: f.status}));
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'HEAD']);
  const seen = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (skip.has(el.tagName.toUpperCase())) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const family = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '');
    const weight = cs.fontWeight;
    const key = `${family}|${weight}`;
    const e = seen.get(key) ?? {family, weight, count: 0, sample: text.slice(0, 40), loaded: document.fonts.check(`${weight} 16px "${family}"`)};
    e.count++;
    seen.set(key, e);
  }
  return {faces, used: [...seen.values()]};
});
