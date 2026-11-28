import React from 'react';
import {Glass} from '../glass';
import {textStyle, unit, useTheme} from '../tokens';
import {hatchCss, type ColorScale} from './colorScale';
import {mapStyleFromTheme} from './styles';

export interface MapLegendProps {
  scale: ColorScale;
  title?: string;
  /** Number formatter for the class boundaries (default: up to 1 decimal). */
  format?: (v: number) => string;
  /** Show the "No data" swatch: 'hatch' | 'muted' (match <Choropleth missing>) or false. Default 'hatch'. */
  missing?: 'hatch' | 'muted' | false;
  missingLabel?: string;
  /** Width in px (default 560 x the theme unit). */
  width?: number;
  style?: React.CSSProperties;
}

const defaultFormat = (v: number) => String(Math.round(v * 10) / 10);

/** Glass legend card for a choropleth colour scale: class swatches (or a ramp), boundary labels and "No data". */
export const MapLegend: React.FC<MapLegendProps> = ({scale, title, format = defaultFormat, missing = 'hatch', missingLabel = 'No data', width, style}) => {
  const theme = useTheme();
  const u = unit(theme);
  const map = mapStyleFromTheme(theme);
  const continuous = scale.classes.length === 0;
  const ticks = continuous ? scale.domain : [...scale.classes.map((c) => c.from), scale.classes[scale.classes.length - 1].to];
  // too many classes to label every boundary: label the ends and the middle
  const dense = ticks.length > 6;
  const shown = dense ? [ticks[0], scale.type === 'diverging' ? scale.domain[1] : ticks[Math.floor(ticks.length / 2)], ticks[ticks.length - 1]] : ticks;
  const caption = textStyle(theme, 'caption', {color: 'secondary', tabular: true});
  const bar = 22 * u;
  return (
    <Glass tier="card" width={width ?? 560 * u} style={{padding: 24 * u, boxSizing: 'border-box', ...style}}>
      {title ? <div style={{...textStyle(theme, 'caption', {weight: 'bold'}), marginBottom: 14 * u}}>{title}</div> : null}
      <div style={{display: 'flex', gap: continuous ? 0 : 3 * u, height: bar, borderRadius: theme.radius.xs * u, overflow: 'hidden', background: continuous ? `linear-gradient(90deg, ${scale.ramp.join(', ')})` : undefined}}>
        {scale.classes.map((c, i) => <div key={i} style={{flex: 1, background: c.color}} />)}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8 * u}}>
        {shown.map((v, i) => <span key={i} style={caption}>{format(v)}</span>)}
      </div>
      {missing ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 12 * u, marginTop: 12 * u}}>
          <div style={{width: 44 * u, height: bar, borderRadius: theme.radius.xs * u, background: missing === 'hatch' ? hatchCss(map.missingHatch, map.missing) : map.missing, border: `1px solid ${map.strokeSoft}`}} />
          <span style={caption}>{missingLabel}</span>
        </div>
      ) : null}
    </Glass>
  );
};
