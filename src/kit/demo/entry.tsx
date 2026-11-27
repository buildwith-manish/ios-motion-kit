/**
 * Standalone Remotion entry for the kit demos only (no video fonts, no video code).
 *   npx remotion studio src/kit/demo/entry.tsx
 *   npx remotion still src/kit/demo/entry.tsx Kit-Tokens-Demo out.png --frame=150
 */
import React from 'react';
import {registerRoot} from 'remotion';
import {KitDemoCompositions} from './TokensDemo';
import {KitTransitionsCompositions} from './TransitionsDemo';
import {KitAudioCompositions} from './AudioDemo';
import {KitCameraCompositions} from './CameraDemo';
import {KitTextCompositions} from './TextDemo';
import {KitQaCompositions} from './QaDemo';
import {KitDatavizCompositions} from './DatavizDemo';
import {KitMapCompositions} from './MapDemo';
import {KitMetroCompositions} from './MetroDemo';

registerRoot(() => (
  <>
    <KitDemoCompositions />
    <KitTransitionsCompositions />
    <KitAudioCompositions />
    <KitCameraCompositions />
    <KitTextCompositions />
    <KitQaCompositions />
    <KitDatavizCompositions />
    <KitMapCompositions />
    <KitMetroCompositions />
  </>
));
