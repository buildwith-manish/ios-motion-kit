import type {TimelineResult} from './Timeline';

/** Formats resolved word, scene, and audio timings for review. */
export const formatTimingTable = (result: TimelineResult, fps: number): string => {
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError('fps must be a finite positive number');
  const rows = [
    'WORD TIMINGS (seconds)',
    'index  word                 start     end       frame',
    '-'.repeat(58),
    ...result.words.map((word, index) =>
      `${String(index + 1).padStart(5)}  ${word.text.padEnd(20)} ${word.start.toFixed(3).padStart(7)}   ${word.end.toFixed(3).padStart(7)}   ${String(Math.round(word.start * fps)).padStart(5)}`,
    ),
    '',
    'SCENE STARTS (seconds)',
    'scene                  start     end',
    '-'.repeat(42),
    ...result.scenes.map((scene) => `${scene.id.padEnd(22)} ${scene.start.toFixed(3).padStart(7)}   ${scene.end === undefined ? '—' : scene.end.toFixed(3)}`),
    '',
    'AUDIO CUES (seconds)',
    'sound                  time      frame',
    '-'.repeat(34),
    ...result.cues.map((cue) => `${cue.name.padEnd(22)} ${cue.at.toFixed(3).padStart(7)}   ${String(Math.round(cue.at * fps)).padStart(5)}`),
  ];
  if (result.warnings.length) rows.push('', 'WARNINGS', ...result.warnings.map((warning) => `- ${warning}`));
  return rows.join('\n');
};
