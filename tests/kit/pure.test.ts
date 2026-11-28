import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {resolveCues, cue} from '../../src/kit/audio/cues';
import {lookAt} from '../../src/kit/camera/lookAt';
import {cameraMotionDelta} from '../../src/kit/camera/sample';
import {tickerStateAt} from '../../src/kit/dataviz/flip';
import {glassStyle} from '../../src/kit/glass/glassStyle';
import {Atmosphere} from '../../src/kit/background/Atmosphere';
import {iosSpring} from '../../src/kit/motion/ios';
import {sceneSequenceDuration, layoutSceneSequence} from '../../src/kit/scenes/sequence';
import type {SceneDefinition} from '../../src/kit/scenes/types';
import {TimingTimeline, atTime} from '../../src/kit/timing/Timeline';
import {parseTimedWordsJson} from '../../src/kit/timing/parsers';
import {transitionProgress} from '../../src/kit/transitions/progress';
import {buildRollSegments, rollValueAt} from '../../src/kit/text/numberRoll';
import {CANVAS, createTheme, safeRect, unit} from '../../src/kit/tokens';
import {ListGroup} from '../../src/kit/ui/components';
import {uiMotionAt} from '../../src/kit/ui/motion';

describe('motion and theme primitives', () => {
  it('keeps the spring bounded at its start and approaches its target', () => {
    expect(iosSpring(0, 0.5)).toBe(0);
    expect(iosSpring(2, 0.5)).toBeGreaterThan(0.99);
  });

  it('validates spring response and remains stable for tiny bounce values', () => {
    expect(() => iosSpring(0.1, 0)).toThrow(RangeError);
    expect(() => iosSpring(0.1, Number.NaN)).toThrow(RangeError);
    expect(Number.isFinite(iosSpring(0.1, 0.5, {bounce: 1e-17}))).toBe(true);
  });

  it('renders Atmosphere with named CSS background colors', () => {
    const theme = createTheme({colors: {background: {base: 'white'}}});
    expect(() => renderToStaticMarkup(createElement(Atmosphere, {frame: 0, theme}))).not.toThrow();
  });

  it('scales tokens consistently and returns an inset safe rectangle', () => {
    const theme = createTheme({canvas: CANVAS.vertical60});
    const safe = safeRect(theme, 'title');
    expect(unit(theme)).toBe(1);
    expect(safe.width).toBeLessThan(theme.canvas.width);
    expect(safe.height).toBeLessThan(theme.canvas.height);
    expect(glassStyle(theme, 'card').borderRadius).toBeGreaterThan(0);
  });

  it('normalizes transition progress exactly at its boundaries', () => {
    expect(transitionProgress(60, 1, 1, 60)).toBe(0);
    expect(transitionProgress(120, 1, 1, 60)).toBe(1);
  });

  it('springs UI presence in and out from explicit seconds', () => {
    expect(uiMotionAt(0, 60, 1, 3).opacity).toBe(0);
    expect(uiMotionAt(120, 60, 1, 3).opacity).toBeGreaterThan(0.99);
    expect(uiMotionAt(360, 60, 1, 3).opacity).toBeLessThan(0.01);
  });

  it('omits staggered list rows whose start is after the group end', () => {
    const html = renderToStaticMarkup(createElement(ListGroup, {
      frame: 60,
      start: 1,
      end: 1.1,
      rowStagger: 0.2,
      theme: createTheme(),
      rows: [{id: 'first', label: 'First'}, {id: 'delayed', label: 'Delayed'}],
    }));
    expect(html).toContain('First');
    expect(html).not.toContain('Delayed');
  });
});

describe('timeline and data helpers', () => {
  it('sorts mixed explicit and motion cues by time', () => {
    const timeline = new TimingTimeline([{text: 'hello', start: 0, end: 2}]);
    timeline.motionCuesAt(atTime(1), [{kind: 'enter-start', at: 0}], [{on: 'enter-start', play: 'pop'}]);
    timeline.cueAt(atTime(2), 'tap');
    expect(timeline.build().cues.map(({name, at}) => [name, at])).toEqual([['pop', 1], ['tap', 2]]);
  });

  it('chains number rolls from the preceding segment value', () => {
    const segments = buildRollSegments({from: 0, to: 100, start: 1, duration: 1, then: [{at: 3, to: 250}]});
    expect(segments[1].from).toBe(100);
    expect(rollValueAt(4, segments)).toBe(250);
  });

  it('keeps ranking rows identified through a reorder', () => {
    const data = [
      {at: 0, rows: [{id: 'a', label: 'Alpha', value: 10}, {id: 'b', label: 'Beta', value: 8}]},
      {at: 2, rows: [{id: 'b', label: 'Beta', value: 12}, {id: 'a', label: 'Alpha', value: 10}]},
    ];
    const atEnd = tickerStateAt(data, 10).filter((row) => row.opacity > 0.99);
    expect(atEnd.map((row) => row.id)).toEqual(['b', 'a']);
    expect(atEnd.map((row) => row.slot)).toEqual([0, 1]);
  });

  it('splits timed word spans without losing their full interval', () => {
    const words = parseTimedWordsJson({words: [{text: 'hello world', start: 1, end: 3}]});
    expect(words.map((word) => word.text)).toEqual(['hello', 'world']);
    expect(words[0].start).toBe(1);
    expect(words[1].end).toBe(3);
  });

  it('centers a camera target and fits it within the canvas', () => {
    const pose = lookAt({x: 100, y: 100, width: 200, height: 100}, {canvas: CANVAS.landscape60, padding: 20});
    expect(pose).toEqual({x: -760, y: -390, scale: 9.4});
  });

  it('keeps zoom motion at the screen anchor when camera pan matches its offset', () => {
    const motion = cameraMotionDelta(
      {x: 378, y: 0, scale: 1, rotate: 0},
      {x: 378, y: 0, scale: 1.1, rotate: 0},
      CANVAS.landscape60,
    );
    expect(Math.abs(motion.dx)).toBeGreaterThan(1);
  });

  it('resolves audio cues deterministically for a fixed seed', () => {
    const cues = [cue('tap', 0), cue('tick', 0.3), cue('pop', 0.8)];
    expect(resolveCues(cues, {seed: 17})).toEqual(resolveCues(cues, {seed: 17}));
  });
});

describe('scene sequence planning', () => {
  const scenes: SceneDefinition[] = [
    {id: 'open', type: 'hook', duration: 3, title: 'A clear opening'},
    {id: 'close', type: 'endCard', duration: 4, title: 'A useful close'},
  ];

  it('subtracts transition overlap from the total and positions each scene', () => {
    const layout = layoutSceneSequence(scenes, {transitionDuration: 0.5, transitionKind: 'push'});
    expect(layout.placements.map(({start, end}) => [start, end])).toEqual([[0, 3], [2.5, 6.5]]);
    expect(sceneSequenceDuration(scenes, {transitionDuration: 0.5})).toBe(6.5);
  });

  it('rejects adjacent transitions that cannot fit within a scene', () => {
    const tooShort: SceneDefinition[] = [
      {id: 'one', type: 'hook', duration: 2, title: 'One'},
      {id: 'two', type: 'stat', duration: 0.8, label: 'Total', value: 1},
      {id: 'three', type: 'endCard', duration: 2, title: 'Three'},
    ];
    expect(() => layoutSceneSequence(tooShort, {transitionDuration: 0.5})).toThrow(/too short/);
  });
});
