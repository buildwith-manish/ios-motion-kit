import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme} from '../tokens';
import type {Canvas} from '../tokens/types';
import {SceneSequence} from './SceneSequence';
import {sceneSequenceFrames} from './sequence';
import type {SceneDefinition} from './types';
import {KitChartHeadlineCompositions} from './ChartHeadlineDemo';

export const SCENE_DEMO_SCENES: readonly SceneDefinition[] = [
  {
    id: 'hook',
    type: 'hook',
    duration: 5,
    eyebrow: 'A practical money story',
    title: 'What if your budget made the next step obvious?',
    body: 'A short, general example of turning a few numbers into a clear decision.',
  },
  {
    id: 'monthly-stat',
    type: 'stat',
    duration: 5,
    label: 'Monthly essentials',
    value: 3250,
    prefix: '$',
    delta: 'A simple baseline to plan around',
  },
  {
    id: 'ranking',
    type: 'ranking',
    duration: 5.5,
    title: 'Where the monthly budget goes',
    highlight: 'home',
    data: [
      {at: 0.6, rows: [
        {id: 'home', label: 'Housing', value: 1800, prefix: '$'},
        {id: 'care', label: 'Family care', value: 620, prefix: '$'},
        {id: 'food', label: 'Food', value: 510, prefix: '$'},
        {id: 'travel', label: 'Transport', value: 320, prefix: '$'},
      ]},
      {at: 3.1, rows: [
        {id: 'home', label: 'Housing', value: 1800, prefix: '$'},
        {id: 'food', label: 'Food', value: 560, prefix: '$'},
        {id: 'care', label: 'Family care', value: 620, prefix: '$'},
        {id: 'travel', label: 'Transport', value: 320, prefix: '$'},
      ]},
    ],
  },
  {
    id: 'comparison',
    type: 'comparison',
    duration: 5.5,
    title: 'A small change adds up',
    left: {label: 'Before', value: 240},
    right: {label: 'After', value: 315},
    prefix: '$',
    suffix: '/mo',
  },
  {
    id: 'shortfall',
    type: 'neededVsEarned',
    duration: 5.5,
    title: 'Keep the goal in view',
    data: {
      needed: {label: 'Monthly target', value: 4200},
      earned: {label: 'Current plan', value: 3650},
      prefix: '$',
      shortfallLabel: '$550 to go',
    },
  },
  {
    id: 'end-card',
    type: 'endCard',
    duration: 6,
    title: 'Make the next decision with confidence.',
    subtitle: 'A clear plan starts with the numbers that matter.',
    actionLabel: 'Your next step',
  },
];

export const SCENE_DEMO_DURATION_IN_FRAMES = sceneSequenceFrames(SCENE_DEMO_SCENES, CANVAS.landscape30.fps);

const SceneDemoFrame: React.FC<{canvas: Canvas}> = ({canvas}) => {
  const frame = useCurrentFrame();
  const theme = createTheme({canvas});
  return <SceneSequence frame={frame} theme={theme} scenes={SCENE_DEMO_SCENES} atmosphere="deep-ocean" finish="light" />;
};

export const KitSceneCompositions: React.FC = () => (
  <>
  <Composition
    id="Kit-Scenes-Demo"
    component={SceneDemoFrame}
    defaultProps={{canvas: CANVAS.landscape30}}
    durationInFrames={SCENE_DEMO_DURATION_IN_FRAMES}
    width={CANVAS.landscape30.width}
    height={CANVAS.landscape30.height}
    fps={CANVAS.landscape30.fps}
  />
  <KitChartHeadlineCompositions />
  </>
);
