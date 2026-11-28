import {cue as makeCue, type Cue, type CueOptions} from '../audio/cues';
import {cuesFromMotion, type CueRule, type MotionEvent} from '../audio/motionCues';
import type {SfxFamily} from '../audio/families';
import type {TimedWord} from '../text/types';
import {findPhrase, findWord} from './anchors';
import {validateTimedWords} from './parsers';

export type TimelineAnchor =
  | {kind: 'word'; query: string; occurrence: number}
  | {kind: 'phrase'; query: string; occurrence: number}
  | {kind: 'time'; at: number};

export const word = (query: string, occurrence = 1): TimelineAnchor => ({kind: 'word', query, occurrence});
export const phrase = (query: string, occurrence = 1): TimelineAnchor => ({kind: 'phrase', query, occurrence});

/** Anchors an event at an explicit second rather than a transcript match. */
export const atTime = (at: number): TimelineAnchor => ({kind: 'time', at});

export interface SceneStart {
  id: string;
  start: number;
  end?: number;
}

export interface TimelineResult {
  words: TimedWord[];
  scenes: SceneStart[];
  cues: Cue[];
  warnings: string[];
}

export class TimelineValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid timing timeline: ${issues.join('; ')}`);
    this.name = 'TimelineValidationError';
    this.issues = issues;
  }
}

interface SceneDefinition {
  id: string;
  anchor?: TimelineAnchor;
  lead: number;
  duration?: number;
  endAnchor?: TimelineAnchor;
}

interface CueRequest {
  anchor: TimelineAnchor;
  family: SfxFamily;
  lead: number;
  options: CueOptions;
}

interface MotionCueRequest {
  anchor: TimelineAnchor;
  lead: number;
  events: readonly MotionEvent[];
  rules: readonly CueRule[];
}

interface SceneStartOptions {
  lead?: number;
}

/** Fluent configuration for one scene start. */
export class SceneTimingBuilder {
  constructor(private readonly definition: SceneDefinition) {}

  startsAt(anchor: TimelineAnchor, options: SceneStartOptions = {}): this {
    this.definition.anchor = anchor;
    this.definition.lead = options.lead ?? 0;
    return this;
  }

  lasts(seconds: number): this {
    this.definition.duration = seconds;
    this.definition.endAnchor = undefined;
    return this;
  }

  endsAt(anchor: TimelineAnchor): this {
    this.definition.endAnchor = anchor;
    this.definition.duration = undefined;
    return this;
  }
}

const resolveAnchor = (anchor: TimelineAnchor, words: readonly TimedWord[]): number | undefined => {
  if (anchor.kind === 'time') return anchor.at;
  if (anchor.kind === 'word') return findWord(words, anchor.query, anchor.occurrence)?.word.start;
  return findPhrase(words, anchor.query, anchor.occurrence)?.[0].start;
};

const describeAnchor = (anchor: TimelineAnchor): string =>
  anchor.kind === 'time' ? `${anchor.at}s` : `${anchor.kind} "${anchor.query}"`;

/** Builds one ordered timing source for text, sound cues, and downstream scene sequences. */
export class TimingTimeline {
  private readonly sceneDefinitions: SceneDefinition[] = [];
  private readonly cueRequests: CueRequest[] = [];
  private readonly motionCueRequests: MotionCueRequest[] = [];

  constructor(private readonly sourceWords: readonly TimedWord[]) {}

  scene(id: string): SceneTimingBuilder {
    const definition: SceneDefinition = {id, lead: 0};
    this.sceneDefinitions.push(definition);
    return new SceneTimingBuilder(definition);
  }

  cueAt(anchor: TimelineAnchor, family: SfxFamily, options: CueOptions & SceneStartOptions = {}): this {
    const {lead = 0, ...cueOptions} = options;
    this.cueRequests.push({anchor, family, lead, options: cueOptions});
    return this;
  }

  /** Binds motion-linked audio events to an anchor, preserving their offsets and event ordering. */
  motionCuesAt(anchor: TimelineAnchor, events: readonly MotionEvent[], rules: readonly CueRule[], options: SceneStartOptions = {}): this {
    this.motionCueRequests.push({anchor, lead: options.lead ?? 0, events, rules});
    return this;
  }

  build(): TimelineResult {
    const issues = validateTimedWords(this.sourceWords);
    const warnings: string[] = [];
    const words = this.sourceWords.map((timedWord) => ({...timedWord}));
    const resolve = (anchor: TimelineAnchor, label: string): number | undefined => {
      const time = resolveAnchor(anchor, words);
      if (time === undefined) warnings.push(`${label}: ${describeAnchor(anchor)} was not found; item skipped`);
      return time;
    };

    const scenes: SceneStart[] = [];
    const names = new Set<string>();
    this.sceneDefinitions.forEach((definition, index) => {
      if (!definition.id.trim()) issues.push(`scene ${index}: id must not be empty`);
      if (names.has(definition.id)) issues.push(`scene "${definition.id}": duplicate id`);
      names.add(definition.id);
      if (!definition.anchor) {
        issues.push(`scene "${definition.id}": startsAt() was not set`);
        return;
      }
      if (!Number.isFinite(definition.lead)) issues.push(`scene "${definition.id}": lead must be finite`);
      const anchorTime = resolve(definition.anchor, `scene "${definition.id}"`);
      if (anchorTime === undefined) return;
      const start = anchorTime + definition.lead;
      if (start < 0 || !Number.isFinite(start)) issues.push(`scene "${definition.id}": start must be finite and non-negative`);

      let end: number | undefined;
      if (definition.duration !== undefined) {
        if (!Number.isFinite(definition.duration) || definition.duration <= 0) {
          issues.push(`scene "${definition.id}": duration must be finite and greater than 0`);
        } else {
          end = start + definition.duration;
        }
      } else if (definition.endAnchor) {
        const endTime = resolve(definition.endAnchor, `end of scene "${definition.id}"`);
        if (endTime !== undefined) end = endTime;
      }
      if (end !== undefined && (!Number.isFinite(end) || end <= start)) {
        issues.push(`scene "${definition.id}": end must be finite and later than start`);
      }
      scenes.push({id: definition.id, start, end});
    });

    for (let index = 1; index < scenes.length; index++) {
      if (scenes[index].start <= scenes[index - 1].start) {
        issues.push(`scene "${scenes[index].id}": starts must be later than the previous scene`);
      }
      if (scenes[index - 1].end !== undefined && scenes[index].start < scenes[index - 1].end!) {
        issues.push(`scene "${scenes[index - 1].id}" overlaps scene "${scenes[index].id}"`);
      }
    }

    const cues: Cue[] = [];
    this.cueRequests.forEach((request, index) => {
      const anchorTime = resolve(request.anchor, `cue ${index}`);
      if (anchorTime === undefined) return;
      const at = anchorTime + request.lead;
      if (!Number.isFinite(at) || at < 0) {
        issues.push(`cue ${index}: time must be finite and non-negative`);
        return;
      }
      cues.push(makeCue(request.family, at, request.options));
    });
    this.motionCueRequests.forEach((request, index) => {
      const anchorTime = resolve(request.anchor, `motion cues ${index}`);
      if (anchorTime === undefined) return;
      const start = anchorTime + request.lead;
      if (!Number.isFinite(start) || start < 0) {
        issues.push(`motion cues ${index}: anchor time must be finite and non-negative`);
        return;
      }
      const events = request.events.map((event) => ({...event, at: event.at + start}));
      cues.push(...cuesFromMotion(events, request.rules));
    });

    cues.sort((a, b) => a.at - b.at);
    cues.forEach((cue, index) => {
      if (!Number.isFinite(cue.at) || cue.at < 0) issues.push(`cue ${index}: time must be finite and non-negative`);
      if (index > 0 && cue.at <= cues[index - 1].at) issues.push(`cue ${index}: times must be strictly increasing`);
    });

    if (issues.length) throw new TimelineValidationError(issues);
    return {words, scenes, cues, warnings};
  }
}
