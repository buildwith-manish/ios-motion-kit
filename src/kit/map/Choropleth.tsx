import React, {useId, useMemo} from 'react';
import {useTheme} from '../tokens';
import {useMap} from './MapCanvas';
import {useRegionShapes} from './useRegionShapes';
import {makeColorScale, type ChoroplethData, type ColorScale, type ColorScaleSpec} from './colorScale';
import {fillProgress, staggerDelays, type ChoroplethOrder} from './choroplethTiming';
import type {RegionSelection} from './regions';
import type {RegionKind} from './types';

export interface ChoroplethProps extends RegionSelection {
  kind: RegionKind;
  /** Tracts only: state FIPS. */
  state?: string;
  /** Read another baked file instead of the kind's default, e.g. detailed ZIP areas 'zcta-metro/<CBSA>.json'. */
  file?: string;
  /** Plain JSON {regionId: value}. Ids: FIPS (state, county, tract), ZCTA code, CBSA code. */
  data: ChoroplethData;
  /** A spec, or a ready scale (share one with <MapLegend>). Default sequential over the data. */
  scale?: ColorScaleSpec | ColorScale;
  /** How regions without a value look. Default 'hatch'. */
  missing?: 'hatch' | 'muted';
  /** Frame number for the fill-in. Omit to draw settled. */
  frame?: number;
  /** Second the fill-in starts (default 0). */
  start?: number;
  /** Seconds between the first and the last region starting (default 1.2). */
  spread?: number;
  /** Spring response per region, seconds (default theme SMOOTH). */
  response?: number;
  order?: ChoroplethOrder;
}

const isScale = (s: ColorScaleSpec | ColorScale): s is ColorScale => typeof (s as ColorScale).color === 'function';

/**
 * Colours regions by value, filling in with a stagger. Which regions are drawn comes from the selection
 * (ids / idPrefix / within); with none, the ids of `data` (so nothing is "missing": pass a selection to show gaps).
 */
export const Choropleth: React.FC<ChoroplethProps> = ({kind, state, file, data, scale = {type: 'sequential'}, missing = 'hatch', frame, start = 0, spread = 1.2, response, order = 'value', ids, idPrefix, within}) => {
  const theme = useTheme();
  const {style} = useMap();
  const patternId = `kithatch${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const selected = ids ?? (idPrefix === undefined && !within ? Object.keys(data) : undefined);
  const shapes = useRegionShapes(kind, {ids: selected, idPrefix, within}, state, file);
  const resolved = isScale(scale) ? scale : makeColorScale(theme, scale, data);
  const delays = useMemo(() => (shapes ? staggerDelays(shapes, data, order, spread) : null), [shapes, data, order, spread]);
  if (!shapes || !delays) return null;
  const time = frame === undefined ? Infinity : frame / theme.canvas.fps;
  const r = response ?? theme.motion.spring.SMOOTH;
  return (
    <g strokeLinejoin="round">
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
          <rect width={8} height={8} fill={style.missing} />
          <rect width={2} height={8} fill={style.missingHatch} />
        </pattern>
      </defs>
      {shapes.map((s) => {
        const p = frame === undefined ? 1 : fillProgress(time, start, delays.get(s.id) ?? 0, r);
        const v = data[s.id];
        const has = typeof v === 'number' && Number.isFinite(v);
        const fill = has ? resolved.color(v) : missing === 'hatch' ? `url(#${patternId})` : style.missing;
        return (
          <g key={s.id}>
            <path d={s.d} fill={style.land} stroke={style.strokeSoft} strokeWidth={style.hairline} vectorEffect="non-scaling-stroke" />
            {p > 0 ? <path d={s.d} fill={fill} fillOpacity={p} stroke={style.water} strokeOpacity={0.7 * p} strokeWidth={style.hairline} vectorEffect="non-scaling-stroke" /> : null}
          </g>
        );
      })}
    </g>
  );
};
