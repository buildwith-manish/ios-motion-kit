import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme} from '../tokens';
import type {Canvas} from '../tokens';
import {SceneSequence, sceneSequenceFrames, type SceneDefinition} from '../scenes';
import {CountdownRail} from './CountdownRail';
import {LowerThird} from './LowerThird';
import {SourceFooter} from './SourceFooter';

const CHAPTERS = [
  {title: 'The method', sub: 'How we measure'},
  {title: 'The countdown', sub: 'Ranked from ten to one'},
  {title: 'The twist', sub: 'Now add what people earn'},
  {title: 'The takeaway', sub: 'What to remember'},
];

export const PRODUCTION_DEMO_SCENES: readonly SceneDefinition[] = [
  {id: 'ch2', type: 'chapter', duration: 3, chapters: CHAPTERS, current: 2},
  {id: 'disclaimer', type: 'disclaimer', duration: 3, title: 'Before we start', text: 'General information, not financial or tax advice.'},
  {id: 'end-yt', type: 'endCard', duration: 5, title: 'Watch the full ranking', subtitle: 'Tap the related video', platform: 'youtube', videoTitle: 'The full ranking, explained'},
  {id: 'end-fb', type: 'endCard', duration: 5, title: 'Full video in the comments', platform: 'facebook', handle: '@yourpage', linkText: 'example.com/full-video', videoTitle: 'The full ranking, explained'},
  {id: 'end-ig', type: 'endCard', duration: 5, title: 'Link in bio', platform: 'instagram', handle: '@yourchannel', bioLines: ['Rankings with real data', 'New video every week'], linkText: 'example.com/full-video', videoTitle: 'The full ranking, explained'},
];

export const PRODUCTION_DEMO_DURATION = sceneSequenceFrames(PRODUCTION_DEMO_SCENES, CANVAS.landscape30.fps);

const ProductionFrame: React.FC<{canvas: Canvas}> = ({canvas}) => {
  const frame = useCurrentFrame();
  const theme = createTheme({canvas});
  const rank = Math.max(1, 10 - Math.floor(frame / canvas.fps / 1.5));
  return (
    <>
      <SceneSequence frame={frame} theme={theme} scenes={PRODUCTION_DEMO_SCENES} atmosphere="deep-ocean" finish="light" />
      <CountdownRail frame={frame} theme={theme} current={rank} prev={rank === 10 ? undefined : rank + 1} at={Math.floor((10 - rank) * 1.5)} orientation="horizontal" length={canvas.width > canvas.height ? 560 : 420} />
      <LowerThird frame={frame} theme={theme} start={3.2} end={5.6} text="General information, not financial or tax advice" />
      <SourceFooter frame={frame} theme={theme} items={[{at: 1, text: 'Example data set A'}, {at: 8, text: 'Example data set B'}, {at: 14, text: ''}]} />
    </>
  );
};

export const KitProductionCompositions: React.FC = () => (
  <>
    <Composition id="Kit-Production-Demo" component={ProductionFrame} defaultProps={{canvas: CANVAS.landscape30}} durationInFrames={PRODUCTION_DEMO_DURATION} width={CANVAS.landscape30.width} height={CANVAS.landscape30.height} fps={CANVAS.landscape30.fps} />
    <Composition id="Kit-Production-Demo-Vertical" component={ProductionFrame} defaultProps={{canvas: CANVAS.vertical30}} durationInFrames={sceneSequenceFrames(PRODUCTION_DEMO_SCENES, CANVAS.vertical30.fps)} width={CANVAS.vertical30.width} height={CANVAS.vertical30.height} fps={CANVAS.vertical30.fps} />
  </>
);
