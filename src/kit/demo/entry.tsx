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
import {KitAtmosphereCompositions} from './AtmosphereDemo';
import {KitIconsCompositions as KitIconsCompositionsRoot} from '../icons/IconsDemo';
import {KitTimingCompositions} from '../timing/TimingDemo';
import {KitMapCompositions} from './MapDemo';
import {KitMetroCompositions} from './MetroDemo';
import {KitFlyCompositions} from './FlyDemo';
import {KitFormatCompositions} from './FormatDemo';
import {KitChartsCompositions} from './ChartsDemo';

registerRoot(() => (
  <>
    <KitDemoCompositions />
    <KitTransitionsCompositions />
    <KitAudioCompositions />
    <KitCameraCompositions />
    <KitTextCompositions />
    <KitQaCompositions />
    <KitDatavizCompositions />
    <KitAtmosphereCompositions />
    <KitIconsCompositionsRoot />
    <KitTimingCompositions />
    <KitMapCompositions />
    <KitMetroCompositions />
    <KitFlyCompositions />
    <KitFormatCompositions />
    <KitChartsCompositions />
  </>
));
export {KitNumberRollCompositions} from './NumberRollDemo';
export {KitFinishCompositions} from './FinishDemo';
export {KitIconsCompositions} from '../icons/IconsDemo';
export {KitTimingCompositions} from '../timing/TimingDemo';
export {KitUiCompositions} from '../ui/UiDemo';
export {KitSceneCompositions} from '../scenes/SceneDemo';
