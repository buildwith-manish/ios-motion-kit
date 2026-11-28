import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, SceneSequence, createTheme, sceneSequenceFrames, type SceneDefinition} from 'ios-motion-kit';
import scenesJson from '../data/scenes.json';

// The video is data: edit data/scenes.json (scene types: see kit/src/kit/scenes/README.md).
const scenes = scenesJson as unknown as readonly SceneDefinition[];
const canvas = CANVAS.landscape30;

const Video: React.FC = () => {
  const frame = useCurrentFrame();
  const theme = createTheme({canvas});
  return <SceneSequence frame={frame} theme={theme} scenes={scenes} atmosphere="deep-ocean" finish="light" />;
};

export const Root: React.FC = () => (
  <Composition id="__COMP__" component={Video} durationInFrames={sceneSequenceFrames(scenes, canvas.fps)} width={canvas.width} height={canvas.height} fps={canvas.fps} />
);
