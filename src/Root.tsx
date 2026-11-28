import React from 'react';
import {
  KitAudioCompositions,
  KitCameraCompositions,
  KitDatavizCompositions,
  KitMapCompositions,
  KitDemoCompositions,
  KitQaCompositions,
  KitTextCompositions,
  KitTransitionsCompositions,
} from './kit/demo';

/** Kit-only root: every demo composition group registered exactly once (same set as src/kit/demo/entry.tsx). */
export const Root: React.FC = () => (
  <>
    <KitDemoCompositions />
    <KitTransitionsCompositions />
    <KitAudioCompositions />
    <KitCameraCompositions />
    <KitTextCompositions />
    <KitQaCompositions />
    <KitDatavizCompositions />
    <KitMapCompositions />
  </>
);
