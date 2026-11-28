import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

/**
 * Bundled Inter (SIL OFL 1.1, see public/kit/fonts/LICENSE). Two weights, matching Theme.weights, in the latin and
 * latin-ext subsets (latin-ext carries the rupee sign and most European accents). Served from public/kit/fonts via
 * staticFile(), so renders, stills and the QA scripts need no network and match the final output.
 */
export interface KitFontFile {
  family: string;
  weight: number;
  /** Path for staticFile(). */
  file: string;
  unicodeRange: string;
}

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** Family name the default themes put first in their font stacks. */
export const KIT_FONT_FAMILY = 'Inter';

/** Every bundled font file. */
export const KIT_FONT_FILES: readonly KitFontFile[] = [
  {family: KIT_FONT_FAMILY, weight: 600, file: 'kit/fonts/inter-latin-600-normal.woff2', unicodeRange: LATIN},
  {family: KIT_FONT_FAMILY, weight: 600, file: 'kit/fonts/inter-latin-ext-600-normal.woff2', unicodeRange: LATIN_EXT},
  {family: KIT_FONT_FAMILY, weight: 700, file: 'kit/fonts/inter-latin-700-normal.woff2', unicodeRange: LATIN},
  {family: KIT_FONT_FAMILY, weight: 700, file: 'kit/fonts/inter-latin-ext-700-normal.woff2', unicodeRange: LATIN_EXT},
];

/**
 * The same faces as an @font-face stylesheet string (for static HTML, or a <style> tag in your own page).
 * @example <style>{kitFontCss()}</style>
 */
export const kitFontCss = (): string =>
  KIT_FONT_FILES.map((f) => `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:block;src:url(${staticFile(f.file)}) format("woff2");unicode-range:${f.unicodeRange};}`).join('\n');

/** Pure: human label of a font file, used in every font error and delayRender message. @example kitFontLabel(KIT_FONT_FILES[2]) // 'Inter 700 latin' */
export const kitFontLabel = (f: KitFontFile): string => `${f.family} ${f.weight} ${f.file.includes('-ext-') ? 'latin-ext' : 'latin'}`;

/** Pure: the error thrown when a kit font cannot load; always names the font and its file. */
export const kitFontError = (f: KitFontFile, cause: unknown): Error =>
  new Error(`Kit font "${kitFontLabel(f)}" (${f.file}) failed to load: ${cause instanceof Error ? cause.message : String(cause)}. The file is read from your public/ folder (staticFile): copy kit/public/kit/fonts to public/kit/fonts.`);

/** Pure: `document.fonts.check()` specs for the bundled faces, one per weight. */
export const kitFontCheckSpecs = (): string[] => [...new Set(KIT_FONT_FILES.map((f) => `${f.weight} 16px "${f.family}"`))];

/** One file must load within this, or the error names it (shorter than the delayRender timeout below). */
export const KIT_FONT_LOAD_TIMEOUT_MS = 25000;
/** delayRender timeout while waiting for the fonts. */
export const KIT_FONT_DELAY_TIMEOUT_MS = 30000;

const faceLoads = new Map<string, Promise<void>>();

/** Loads one file once per page (shared by loadKitFonts and useKitFonts); rejects with an error naming the font. */
const loadFace = (f: KitFontFile): Promise<void> => {
  let p = faceLoads.get(f.file);
  if (!p) {
    const face = new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, {weight: String(f.weight), style: 'normal', unicodeRange: f.unicodeRange, display: 'block'});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`no response after ${KIT_FONT_LOAD_TIMEOUT_MS} ms`)), KIT_FONT_LOAD_TIMEOUT_MS); });
    p = Promise.race([face.load(), timeout])
      .then(() => { document.fonts.add(face); })
      .catch((e) => { throw kitFontError(f, e); })
      .finally(() => clearTimeout(timer));
    faceLoads.set(f.file, p);
  }
  return p;
};

let pending: Promise<void> | null = null;

/**
 * Registers and loads the bundled Inter faces once per page. Holds the render (delayRender) until every file is
 * decoded, so no frame is ever painted in a fallback font. Safe to call many times and in non-browser code (no-op).
 * Already called when the kit is imported; call it yourself only to await readiness. A failure is logged, not thrown
 * (use useKitFonts() or loadKitFontsStrict() to fail the render instead).
 * @example await loadKitFonts();
 */
export const loadKitFonts = (): Promise<void> => {
  if (pending) return pending;
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return (pending = Promise.resolve());
  const handle = delayRender('Loading kit fonts (Inter)', {timeoutInMilliseconds: KIT_FONT_DELAY_TIMEOUT_MS});
  pending = loadKitFontsStrict()
    .catch((e) => {
      // Never block a render on a font at import time: fall back to the system stack and say so.
      console.warn('kit fonts failed to load, using the fallback stack', e);
    })
    .finally(() => continueRender(handle));
  return pending;
};

/** Like loadKitFonts but rejects with an error naming the font that failed or timed out. Resolves at once outside a browser. */
export const loadKitFontsStrict = (): Promise<void> => {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  return Promise.all(KIT_FONT_FILES.map(loadFace)).then(() => document.fonts.ready).then(() => undefined);
};

/**
 * The one font-loading hook: holds the render until every kit font is loaded, and cancels it with an error that names
 * the font if one fails or times out. Returns true once loaded. Used by <KitFontGate>, every kit demo entry and the
 * scaffold template; call it in a composition only if you do not use the gate.
 * @example const ready = useKitFonts();
 */
export const useKitFonts = (): boolean => {
  const [token] = useState(() => {
    const live = typeof document !== 'undefined' && typeof FontFace !== 'undefined';
    return {live, released: false, handle: live ? delayRender(`Waiting for kit fonts: ${KIT_FONT_FILES.map(kitFontLabel).join(', ')}`, {timeoutInMilliseconds: KIT_FONT_DELAY_TIMEOUT_MS}) : 0};
  });
  const [ready, setReady] = useState(!token.live);
  useEffect(() => {
    if (!token.live) return undefined;
    let alive = true;
    loadKitFontsStrict().then(() => { if (alive) setReady(true); }, (e) => cancelRender(e));
    return () => { alive = false; };
  }, [token]);
  // Release after the commit that follows `ready`, so the first painted frame already uses the loaded faces.
  useEffect(() => {
    if (ready && token.live && !token.released) { token.released = true; continueRender(token.handle); }
  }, [ready, token]);
  return ready;
};

// Side effect on import: any composition that uses a theme gets its fonts before the first frame.
void loadKitFonts();
