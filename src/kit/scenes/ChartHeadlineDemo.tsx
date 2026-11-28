import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme} from '../tokens';
import type {Canvas} from '../tokens/types';
import {SceneSequence} from './SceneSequence';
import {sceneSequenceFrames} from './sequence';
import type {SceneDefinition} from './types';

/** Two chartHeadline scenes: a bar chart with a 2x compare marker, and a slope chart that hands focus city by city (sample data). */
export const CHART_HEADLINE_DEMO_SCENES: readonly SceneDefinition[] = [
  {
    id: 'bar-claim',
    type: 'chartHeadline',
    duration: 8,
    title: 'Housing costs twice as much as food',
    subtitle: 'Monthly spending, sample household',
    chart: {
      kind: 'bar',
      format: 'usd',
      data: [{label: 'Housing', value: 1800}, {label: 'Food', value: 900}, {label: 'Transport', value: 640}, {label: 'Care', value: 520}],
    },
    emphasis: {steps: [{at: 2, focus: 'Food', label: 'Food: the baseline'}, {at: 3.6, focus: ['Housing', 'Food'], label: 'Housing is 2x food'}]},
    labels: [{item: 'Food', at: 2.2}, {item: 'Housing', at: 3.8}],
    compare: [{from: 'Food', to: 'Housing', mode: 'ratio', at: 4}],
    source: 'Source: Sample data',
  },
  {
    id: 'slope-handoff',
    type: 'chartHeadline',
    duration: 10,
    title: 'Austin rents rose fastest; Memphis barely moved',
    chart: {
      kind: 'slope',
      format: 'usd',
      leftLabel: '2023',
      rightLabel: '2025',
      items: [{name: 'Austin', from: 1450, to: 1900}, {name: 'Denver', from: 1600, to: 1850}, {name: 'Chicago', from: 1500, to: 1620}, {name: 'Memphis', from: 1000, to: 1090}],
    },
    emphasis: {
      steps: [
        {at: 2, focus: 'Austin', label: 'Austin: +$450'},
        {at: 4, focus: 'Denver', label: 'Denver: +$250'},
        {at: 6, focus: 'Chicago', label: 'Chicago: +$120'},
        {at: 8, focus: 'Memphis', label: 'Memphis: +$90'},
      ],
    },
    source: 'Source: Sample data',
  },
];

export const CHART_HEADLINE_DEMO_FRAMES = sceneSequenceFrames(CHART_HEADLINE_DEMO_SCENES, CANVAS.landscape30.fps);

const Frame: React.FC<{canvas: Canvas}> = ({canvas}) => {
  const frame = useCurrentFrame();
  const theme = createTheme({canvas});
  return <SceneSequence frame={frame} theme={theme} scenes={CHART_HEADLINE_DEMO_SCENES} atmosphere="deep-ocean" finish="light" />;
};

export const KitChartHeadlineCompositions: React.FC = () => (
  <>
    <Composition id="Kit-ChartHeadline-Demo" component={Frame} defaultProps={{canvas: CANVAS.landscape30}} durationInFrames={CHART_HEADLINE_DEMO_FRAMES} width={CANVAS.landscape30.width} height={CANVAS.landscape30.height} fps={CANVAS.landscape30.fps} />
    <Composition id="Kit-ChartHeadline-Demo-Vertical" component={Frame} defaultProps={{canvas: CANVAS.vertical30}} durationInFrames={CHART_HEADLINE_DEMO_FRAMES} width={CANVAS.vertical30.width} height={CANVAS.vertical30.height} fps={CANVAS.vertical30.fps} />
  </>
);
