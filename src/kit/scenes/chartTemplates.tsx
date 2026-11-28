import React, {useMemo} from 'react';
import {iosSpring, SPRING} from '../motion';
import {textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {formatNumber} from '../text/format';
import {
  BarMark, Chart, CompareMarker, DirectLabel, LineMark, SectorMark, SlopeChart, Waterfall, emphasisOpacity, emphasisStepProgress, emphasisTime, seriesColor,
  type ChartEmphasis,
} from '../charts';
import {MapSourceLine} from '../map';
import {chartHeadlineLayout} from './chartHeadlineLayout';
import {chartSceneSource, resolveChartItem} from './chartSceneValidation';
import type {ChartHeadlineSceneData} from './types';
import type {SceneTemplateProps} from './templates';

export interface ChartHeadlineSceneProps extends SceneTemplateProps {scene: ChartHeadlineSceneData}

const DEFAULT_REVEAL = 0.6;

/** chartHeadline: the title is the claim; the chart reveals, then emphasis steps hand focus from item to item. Seconds in the scene are relative to its start. */
export const ChartHeadlineScene: React.FC<ChartHeadlineSceneProps> = ({frame, start, theme, scene}) => {
  const u = unit(theme);
  const fps = theme.canvas.fps;
  const time = frame / fps;
  const L = useMemo(() => chartHeadlineLayout(theme, scene), [theme, scene.title, scene.subtitle]);
  const reveal = start + (scene.reveal?.start ?? DEFAULT_REVEAL);
  const emphasis: ChartEmphasis | undefined = useMemo(
    () => (scene.emphasis ? {steps: scene.emphasis.steps.map((s) => ({at: start + s.at, focus: s.focus, label: s.label})), dimTo: scene.emphasis.dimTo} : undefined),
    [scene.emphasis, start],
  );
  const c = scene.chart;
  const intro = (delay: number): number => iosSpring(time - start - delay, SPRING.SMOOTH);
  const source = chartSceneSource(scene);
  const common = {frame, start: reveal, fps, theme, width: L.chart.w, height: L.chart.h, emphasis};

  let chart: React.ReactNode = null;
  if (c.kind === 'bar') {
    chart = (
      <Chart x={c.data.map((d) => d.label)} series={[{name: 'Value', values: c.data.map((d) => d.value)}]} yFormat={c.format ?? 'int'} orientation={c.orientation} {...common}>
        <BarMark />
        <DirectLabel labels={(scene.labels ?? []).map((l) => ({index: resolveChartItem(c, l.item), series: l.series, text: l.text, side: l.side, at: start + (l.at ?? (scene.reveal?.start ?? DEFAULT_REVEAL) + 1.2)}))} />
        {(scene.compare ?? []).map((m, i) => (
          <CompareMarker key={i} from={{index: resolveChartItem(c, m.from), series: m.series}} to={{index: resolveChartItem(c, m.to), series: m.series}} mode={m.mode} text={m.text} shape={m.shape} format={c.format} at={start + (m.at ?? (scene.reveal?.start ?? DEFAULT_REVEAL) + 1.6)} />
        ))}
      </Chart>
    );
  } else if (c.kind === 'line') {
    chart = (
      <Chart x={c.x} series={c.series.map((s) => ({name: s.name, values: s.values}))} yFormat={c.format ?? 'int'} legend={c.series.length > 1} endLabels={c.series.length > 1} {...common}>
        <LineMark endLabels={c.series.length > 1} />
        <DirectLabel labels={(scene.labels ?? []).map((l) => ({index: resolveChartItem(c, l.item), series: l.series, text: l.text, side: l.side, at: start + (l.at ?? (scene.reveal?.start ?? DEFAULT_REVEAL) + 1.2)}))} />
        {(scene.compare ?? []).map((m, i) => (
          <CompareMarker key={i} from={{index: resolveChartItem(c, m.from), series: m.series}} to={{index: resolveChartItem(c, m.to), series: m.series}} mode={m.mode} text={m.text} shape={m.shape} format={c.format} at={start + (m.at ?? (scene.reveal?.start ?? DEFAULT_REVEAL) + 1.6)} />
        ))}
      </Chart>
    );
  } else if (c.kind === 'slope') {
    chart = <SlopeChart items={c.items} leftLabel={c.leftLabel} rightLabel={c.rightLabel} format={c.format} {...common} />;
  } else if (c.kind === 'waterfall') {
    chart = <Waterfall items={c.items} opening={c.opening} yFormat={c.format ?? 'int'} {...common} />;
  } else {
    const side = Math.min(L.chart.h, L.portrait ? L.chart.w : L.chart.w * 0.5);
    const fmt = c.format ?? 'int';
    chart = (
      <div style={{display: 'flex', flexDirection: L.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: 40 * u, width: L.chart.w, height: L.chart.h}}>
        <SectorMark data={c.data} size={side * (L.portrait ? 0.7 : 0.95)} frame={frame} start={reveal} fps={fps} theme={theme} emphasis={emphasis} />
        <div style={{display: 'flex', flexDirection: 'column', gap: 14 * u}}>
          {c.data.map((d, i) => (
            <div key={d.label} style={{display: 'flex', alignItems: 'center', gap: 14 * u, opacity: emphasisOpacity(theme, emphasis, emphasisTime(frame, fps), {id: d.label, index: i})}}>
              <span style={{width: 18 * u, height: 18 * u, borderRadius: 18 * u, background: seriesColor(theme, i)}} />
              <span style={{...textStyle(theme, 'body'), color: theme.colors.text.primary}}>{d.label}</span>
              <span style={{...textStyle(theme, 'body'), color: theme.colors.text.secondary, fontVariantNumeric: 'tabular-nums'}}>{formatNumber(d.value, fmt)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const steps = emphasis?.steps ?? [];
  const sortedSteps = [...steps].sort((a, b) => a.at - b.at);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: L.title.x, top: L.title.y, width: L.title.w, height: L.title.h, opacity: intro(0.05), transform: `translateY(${(1 - intro(0.05)) * 14 * u}px)`}}>
        <div style={{...textStyle(theme, 'title'), fontSize: L.title.fontPx, lineHeight: 1.15, color: theme.colors.text.primary}}>{scene.title}</div>
      </div>
      {L.subtitle ? (
        <div style={{position: 'absolute', left: L.subtitle.x, top: L.subtitle.y, width: L.subtitle.w, opacity: intro(0.25)}}>
          <div style={{...textStyle(theme, 'body'), color: theme.colors.text.secondary}}>{scene.subtitle}</div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: L.chart.x, top: L.chart.y, width: L.chart.w, height: L.chart.h}}>{chart}</div>
      <div style={{position: 'absolute', left: L.caption.x, top: L.caption.y, width: L.caption.w, height: L.caption.h}}>
        {sortedSteps.map((s, i) => (s.label ? (
          <div key={i} style={{position: 'absolute', left: 0, top: 0, opacity: emphasisStepProgress(time, emphasis as ChartEmphasis, i), ...textStyle(theme, 'caption'), color: theme.colors.accent}}>{s.label}</div>
        ) : null))}
      </div>
      {source ? <MapSourceLine text={source} style={{position: 'absolute', left: L.source.x, top: L.source.y}} /> : null}
    </div>
  );
};
