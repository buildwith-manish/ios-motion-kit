import React from 'react';
import type {CSSProperties} from 'react';
import {SPRING} from '../motion';
import {unit} from '../tokens/helpers';
import {useTheme} from '../tokens/ThemeProvider';
import {rgba} from '../tokens/color';
import type {Theme} from '../tokens/types';
import {springProgress, type DvPoint, type Tone} from '../dataviz/common';
import {seriesColor} from './palette';
import {emphasisOpacity, emphasisTime, type ChartEmphasis} from './emphasis';
import {arcPath, polar, sectorAngles, type SectorAngle} from './recipeGeometry';

export interface SectorDatum {
  label: string;
  value: number;
  tone?: Tone;
}

export interface SectorMarkProps {
  data: readonly SectorDatum[];
  /** Outer diameter, canvas px. Default 520. */
  size?: number;
  /** Ring thickness, design px. Default 70. */
  thickness?: number;
  /** Gap between sectors, degrees. Default 2.5. */
  gapDeg?: number;
  /** Degrees clockwise from 12 o'clock. Default 0. */
  startDeg?: number;
  frame?: number;
  /** Seconds. */
  start?: number;
  response?: number;
  fps?: number;
  /** Content centred in the hole (e.g. a NumberText total). */
  center?: React.ReactNode;
  /** Focus steps; sectors are matched by `label` (or index). */
  emphasis?: ChartEmphasis;
  theme?: Theme;
  style?: CSSProperties;
}

/** Px midpoints (on the ring's centre line, relative to the component box) of each sector, for <Callout> anchors. */
export const sectorMidpoints = (data: readonly SectorDatum[], size: number, thicknessPx: number, o: {gapDeg?: number; startDeg?: number} = {}): Array<{index: number; point: DvPoint; angle: SectorAngle}> => {
  const r = size / 2;
  return sectorAngles(data.map((d) => d.value), {gapDeg: o.gapDeg ?? 2.5, startDeg: o.startDeg}).map((angle) => ({index: angle.index, angle, point: polar(r, r, r - thicknessPx / 2, angle.mid)}));
};

/** Multi-segment donut that sweeps round on an iOS spring. Values <= 0 or missing get no sector; an empty chart shows only the faint track. */
export const SectorMark: React.FC<SectorMarkProps> = (props) => {
  const ctxTheme = useTheme();
  const theme = props.theme ?? ctxTheme;
  const u = unit(theme);
  const size = props.size ?? 520;
  const thick = (props.thickness ?? 70) * u;
  const r = size / 2;
  const fps = props.fps ?? theme.canvas.fps;
  const p = props.frame === undefined ? 1 : springProgress(props.frame / fps - (props.start ?? 0), props.response ?? SPRING.GENTLE);
  const angles = sectorAngles(props.data.map((d) => d.value), {gapDeg: props.gapDeg ?? 2.5, startDeg: props.startDeg});
  const start0 = props.startDeg ?? 0;
  return (
    <div style={{position: 'relative', width: size, height: size, ...props.style}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={r} cy={r} r={r - thick / 2} fill="none" stroke={rgba(theme.colors.text.primary, 0.08)} strokeWidth={thick} />
        {angles.map((a) => {
          const a0 = start0 + (a.start - start0) * p;
          const a1 = start0 + (a.end - start0) * p;
          if (a1 - a0 < 0.01) return null;
          const mo = emphasisOpacity(theme, props.emphasis, emphasisTime(props.frame, fps), {id: props.data[a.index].label, index: a.index});
          return <path key={a.index} d={arcPath(r, r, r, r - thick, a0, a1)} fill={seriesColor(theme, a.index, props.data[a.index].tone)} opacity={mo} />;
        })}
      </svg>
      {props.center ? <div style={{position: 'absolute', left: thick, top: thick, width: size - 2 * thick, height: size - 2 * thick, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>{props.center}</div> : null}
    </div>
  );
};
