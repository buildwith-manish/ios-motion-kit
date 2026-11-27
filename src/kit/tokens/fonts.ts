import {continueRender, delayRender, staticFile} from 'remotion';

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

let pending: Promise<void> | null = null;

/**
 * Registers and loads the bundled Inter faces once per page. Holds the render (delayRender) until every file is
 * decoded, so no frame is ever painted in a fallback font. Safe to call many times and in non-browser code (no-op).
 * Already called when the kit is imported; call it yourself only to await readiness.
 * @example await loadKitFonts();
 */
export const loadKitFonts = (): Promise<void> => {
  if (pending) return pending;
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return (pending = Promise.resolve());
  const handle = delayRender('Loading kit fonts (Inter)', {timeoutInMilliseconds: 30000});
  pending = Promise.all(
    KIT_FONT_FILES.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, {weight: String(f.weight), style: 'normal', unicodeRange: f.unicodeRange, display: 'block'});
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => document.fonts.ready)
    .then(() => undefined)
    .catch((e) => {
      // Never block a render on a font: fall back to the system stack and say so.
      console.warn('kit fonts failed to load, using the fallback stack', e);
    })
    .finally(() => continueRender(handle));
  return pending;
};

// Side effect on import: any composition that uses a theme gets its fonts before the first frame.
void loadKitFonts();
