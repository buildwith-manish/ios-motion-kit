import type {SceneDefinition, ScenePlacement, SceneSequenceLayout, SceneSequenceOptions, SceneTransitionWindow} from './types';
import type {TransitionKind} from '../transitions';
import {validateMapScene} from './mapSceneValidation';
import {validateChartScene} from './chartSceneValidation';

const TRANSITION_KINDS: readonly TransitionKind[] = ['push', 'blurDissolve', 'sheet', 'zoomThrough', 'matchedGeometry', 'wipeMask'];

const finitePositive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`);
};

/** Computes absolute scene intervals; transition windows overlap the outgoing and incoming scenes. */
export const layoutSceneSequence = (
  scenes: readonly SceneDefinition[],
  options: SceneSequenceOptions = {},
): SceneSequenceLayout => {
  if (!scenes.length) throw new RangeError('SceneSequence requires at least one scene');
  const defaultDuration = options.transitionDuration ?? 0.5;
  if (!Number.isFinite(defaultDuration) || defaultDuration < 0) throw new RangeError('transitionDuration must be finite and non-negative');
  const defaultKind = options.transitionKind ?? 'blurDissolve';
  if (!TRANSITION_KINDS.includes(defaultKind)) throw new RangeError(`Unknown transition kind: ${defaultKind}`);

  const ids = new Set<string>();
  const durations = scenes.map((scene) => {
    if (!scene.id.trim() || ids.has(scene.id)) throw new RangeError(`Scene ids must be non-empty and unique: "${scene.id}"`);
    ids.add(scene.id);
    finitePositive(scene.duration, `Scene "${scene.id}" duration`);
    validateMapScene(scene);
    validateChartScene(scene);
    return scene.duration;
  });

  const transitions: (SceneTransitionWindow | undefined)[] = scenes.map((scene, index) => {
    if (index === scenes.length - 1) {
      if (scene.transition !== undefined && scene.transition !== false) throw new RangeError(`Last scene "${scene.id}" cannot have an outgoing transition`);
      return undefined;
    }
    if (scene.transition === false) return undefined;
    const config = scene.transition ?? {};
    const duration = config.duration ?? defaultDuration;
    if (duration === 0) return undefined;
    finitePositive(duration, `Scene "${scene.id}" transition duration`);
    const kind = config.kind ?? defaultKind;
    if (!TRANSITION_KINDS.includes(kind)) throw new RangeError(`Unknown transition kind: ${kind}`);
    if (config.response !== undefined) finitePositive(config.response, `Scene "${scene.id}" transition response`);
    return {kind, duration, start: 0, response: config.response, curve: config.curve, motionBlur: config.motionBlur};
  });

  for (let index = 1; index < scenes.length; index++) {
    const incoming = transitions[index - 1]?.duration ?? 0;
    const outgoing = transitions[index]?.duration ?? 0;
    if (incoming + outgoing > durations[index] + 1e-9) {
      throw new RangeError(`Scene "${scenes[index].id}" is too short for its adjacent transitions`);
    }
  }

  const placements: ScenePlacement[] = [];
  let start = 0;
  scenes.forEach((scene, index) => {
    const end = start + durations[index];
    const transition = transitions[index];
    if (transition) transition.start = end - transition.duration;
    placements.push({scene, start, end, transition});
    start = end - (transition?.duration ?? 0);
  });
  return {placements, duration: placements[placements.length - 1].end};
};

/** Total playback duration in seconds, including the overlap removed by each transition. */
export const sceneSequenceDuration = (scenes: readonly SceneDefinition[], options: SceneSequenceOptions = {}): number =>
  layoutSceneSequence(scenes, options).duration;

/** Composition frame count rounded up so the final scene's last instant is covered. */
export const sceneSequenceFrames = (scenes: readonly SceneDefinition[], fps: number, options: SceneSequenceOptions = {}): number => {
  finitePositive(fps, 'fps');
  return Math.ceil(sceneSequenceDuration(scenes, options) * fps);
};
