import React from 'react';
import type {Theme} from '../tokens';
import {hatchCss, type ChoroplethData, type ColorScale} from './colorScale';
import {fillProgress, staggerDelays, type ChoroplethOrder} from './choroplethTiming';
import type {MapShape} from './regions';
import {mapStyleFromTheme} from './styles';
import {inkOn, tileGridLayout} from './tileGridLayout';

export interface TileGridMapProps {
  theme: Theme;
  /** Frame number (passed in; pure). */
  frame: number;
  /** Second the first tile starts to fill. */
  start: number;
  /** Seconds over which all tiles start (default 1.4). */
  spread?: number;
  order?: ChoroplethOrder;
  /** {USPS code: value}; null / absent = missing (hatched). */
  data: ChoroplethData;
  scale: ColorScale;
  box: {x0: number; y0: number; x1: number; y1: number};
  /** Draw the formatted value under the code when tiles are big enough (default true). */
  showValues?: boolean;
  format?: (v: number) => string;
}

/**
 * US state tile grid, one rounded square per state and DC, filled from a ColorScale with a staggered spring. Missing values
 * are hatched like <Choropleth>. Pure function of `frame`.
 * @example <TileGridMap theme={theme} frame={frame} start={0.6} data={{CO: 12, TX: 30}} scale={scale} box={{x0: 96, y0: 240, x1: 1200, y1: 1000}} />
 */
export const TileGridMap: React.FC<TileGridMapProps> = ({theme, frame, start, spread = 1.4, order = 'value', data, scale, box, showValues = true, format = (v) => String(Math.round(v * 10) / 10)}) => {
  const layout = tileGridLayout(box);
  const style = mapStyleFromTheme(theme);
  const time = frame / theme.canvas.fps;
  const shapes = layout.tiles.map((t) => ({id: t.id, centroid: [t.col, t.row]}) as unknown as MapShape);
  const delays = staggerDelays(shapes, data, order, spread);
  const withValue = showValues && layout.tile >= 56;
  const font = theme.fonts.body;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {layout.tiles.map((t) => {
        const v = data[t.id];
        const has = typeof v === 'number' && Number.isFinite(v);
        const p = fillProgress(time, start, delays.get(t.id) ?? 0, 0.5);
        const fill = has ? scale.color(v) : style.missing;
        const ink = has ? inkOn(fill) : theme.colors.text.secondary;
        return (
          <div key={t.id} data-tile={t.id} style={{position: 'absolute', left: t.x, top: t.y, width: t.size, height: t.size, borderRadius: t.size * 0.16, background: has ? fill : hatchCss(style.missingHatch, style.missing), opacity: 0.18 + 0.82 * p, transform: `scale(${0.86 + 0.14 * p})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: ink, fontFamily: font, fontWeight: theme.weights.bold, lineHeight: 1}}>
            <div style={{fontSize: t.size * 0.3}}>{t.id}</div>
            {withValue && has ? <div style={{fontSize: t.size * 0.2, fontWeight: theme.weights.regular, marginTop: t.size * 0.06, fontVariantNumeric: 'tabular-nums'}}>{format(v)}</div> : null}
          </div>
        );
      })}
    </div>
  );
};
