import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme} from '../tokens';
import type {Canvas} from '../tokens/types';
import {SceneSequence} from './SceneSequence';
import {sceneSequenceFrames} from './sequence';
import {MAP_SCENES_DEMO_SCENES} from './mapScenesDemoData';

export {MAP_SCENES_DEMO_SCENES} from './mapScenesDemoData';

const Frame: React.FC<{canvas: Canvas}> = ({canvas}) => {
  const frame = useCurrentFrame();
  return <SceneSequence frame={frame} theme={createTheme({canvas})} scenes={MAP_SCENES_DEMO_SCENES} atmosphere="deep-ocean" finish="light" />;
};

/**
 * Registers the data-only map example video: `Kit-MapScenes-Demo` (16:9 @ 30) and `Kit-MapScenes-Demo-Vertical` (9:16 @ 30).
 * @example <KitMapSceneCompositions />
 */
export const KitMapSceneCompositions: React.FC = () => (
  <>
    {([['Kit-MapScenes-Demo', CANVAS.landscape30], ['Kit-MapScenes-Demo-Vertical', CANVAS.vertical30]] as const).map(([id, canvas]) => (
      <Composition key={id} id={id} component={Frame} defaultProps={{canvas}} durationInFrames={sceneSequenceFrames(MAP_SCENES_DEMO_SCENES, canvas.fps)} width={canvas.width} height={canvas.height} fps={canvas.fps} />
    ))}
  </>
);
