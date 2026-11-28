import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, safeRect, ThemeProvider, unit, type Theme} from '../index';
import {NumberText} from '../text';
import {formatNumber, monthYear, quarter, type FormatPresetName} from '../text/format';

/** Seconds per preset slot; the roll runs from 0.3 s. */
export const FORMAT_SLOT = 2;

/** One slot per preset: sample inputs (static) and a rolling number with the same preset. */
export const FORMAT_CASES: ReadonlyArray<{preset: FormatPresetName; samples: readonly number[]; from: number; to: number}> = [
  {preset: 'usd', samples: [0, 1234.5, -1234.5, 999999], from: 0, to: 2480},
  {preset: 'usdCompact', samples: [999, 12_345, 999_950, 2.5e9], from: 0, to: 12_345_678},
  {preset: 'pct', samples: [0, 0.123, -0.0456, 1.5], from: 0, to: 0.427},
  {preset: 'pp', samples: [0, 1.2, -1.2, 12.34], from: 0, to: 3.4},
  {preset: 'delta', samples: [0, 5, -5, 1234], from: 0, to: 87},
  {preset: 'int', samples: [0, 1234, -1234, 1234567], from: 0, to: 9421},
  {preset: 'decimal1', samples: [0, 3, -3.14159, 1234.56], from: 0, to: 4.7},
  {preset: 'decimal2', samples: [0, 3, -3.14159, 1234.567], from: 0, to: 4.75},
  {preset: 'bps', samples: [0, 25, -25, 150], from: 0, to: 125},
];

export const FormatDemo: React.FC<{theme?: Theme}> = (props) => {
  const frame = useCurrentFrame();
  const theme = props.theme ?? createTheme();
  const fps = theme.canvas.fps;
  const index = Math.min(FORMAT_CASES.length - 1, Math.floor(frame / (FORMAT_SLOT * fps)));
  const c = FORMAT_CASES[index];
  const local = frame - index * FORMAT_SLOT * fps;
  const safe = safeRect(theme, 'title');
  const bg = theme.colors.background;
  const u = unit(theme);
  const label: React.CSSProperties = {fontFamily: theme.fonts.body, fontSize: 30 * u, fontWeight: theme.weights.bold, color: theme.colors.text.tertiary};
  return (
    <div style={{position: 'relative', width: theme.canvas.width, height: theme.canvas.height, overflow: 'hidden', background: `linear-gradient(160deg, ${bg.lift}, ${bg.base})`}}>
      <ThemeProvider theme={theme}>
        <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 * u}}>
          <div style={label}>{c.preset}</div>
          <NumberText from={c.from} to={c.to} format={c.preset} layout="reserve" frame={local} start={0.3} duration={1.2} role="number" fontSize={200 * u} />
          <div style={{...label, color: theme.colors.text.secondary}}>
            {c.samples.map((v) => `${v} → ${formatNumber(v, c.preset)}`).join('    ')}
          </div>
          <div style={label}>{`${quarter('2026-09-15T00:00:00Z')}   ${monthYear('2026-09-15T00:00:00Z')}`}</div>
        </div>
      </ThemeProvider>
    </div>
  );
};

export const KitFormatCompositions: React.FC = () => (
  <Composition id="Kit-Format-Demo" component={FormatDemo} durationInFrames={FORMAT_CASES.length * FORMAT_SLOT * 60} width={CANVAS.landscape60.width} height={CANVAS.landscape60.height} fps={60} />
);
