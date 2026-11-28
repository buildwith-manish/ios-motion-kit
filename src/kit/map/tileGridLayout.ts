/** US state tile grid: one square per state plus DC on an 11 x 8 grid (pure layout, keyed by USPS code). */
export const TILE_GRID_COLS = 11;
export const TILE_GRID_ROWS = 8;

/** USPS code -> [column, row], row 0 at the top. */
export const TILE_GRID_CELLS: Readonly<Record<string, readonly [number, number]>> = {
  AK: [0, 0], ME: [10, 0],
  VT: [9, 1], NH: [10, 1],
  WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], MA: [10, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
  CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], RI: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DE: [9, 5], DC: [10, 5],
  OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6],
  HI: [0, 7], TX: [4, 7], FL: [9, 7],
};

export interface TileRect {id: string; col: number; row: number; x: number; y: number; size: number}
export interface TileGridLayout {tile: number; gap: number; width: number; height: number; x0: number; y0: number; tiles: TileRect[]}

/**
 * Fits the grid inside `box` (px): square tiles with a gap of `gapRatio` x tile, centred. Pure.
 * @example tileGridLayout({x0: 96, y0: 240, x1: 1200, y1: 1000}).tiles[0]
 */
export const tileGridLayout = (box: {x0: number; y0: number; x1: number; y1: number}, gapRatio = 0.1): TileGridLayout => {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  if (!(w > 0 && h > 0)) throw new RangeError(`tileGridLayout: box must have a positive size, got ${w} x ${h}`);
  const tile = Math.min(w / (TILE_GRID_COLS + (TILE_GRID_COLS - 1) * gapRatio), h / (TILE_GRID_ROWS + (TILE_GRID_ROWS - 1) * gapRatio));
  const gap = tile * gapRatio;
  const width = TILE_GRID_COLS * tile + (TILE_GRID_COLS - 1) * gap;
  const height = TILE_GRID_ROWS * tile + (TILE_GRID_ROWS - 1) * gap;
  const x0 = box.x0 + (w - width) / 2;
  const y0 = box.y0 + (h - height) / 2;
  const tiles = Object.entries(TILE_GRID_CELLS).map(([id, [col, row]]) => ({id, col, row, x: x0 + col * (tile + gap), y: y0 + row * (tile + gap), size: tile}));
  return {tile, gap, width, height, x0, y0, tiles};
};

/** Black or white text, whichever contrasts more with a `#rrggbb` fill (white for anything unparsable). */
export const inkOn = (fill: string, dark = '#0b0f14', light = '#ffffff'): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(fill.trim());
  if (!m) return light;
  const lin = (i: number) => { const c = parseInt(m[1].slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? dark : light;
};
