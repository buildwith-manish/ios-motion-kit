import type {AtmospherePreset} from '../background';
import type {ShortfallBarsData, TickerStep} from '../dataviz';
import type {FinishLevel} from '../finish';
import type {TransitionKind, MotionBlurOption} from '../transitions';

export interface SceneTransition {
  kind?: TransitionKind;
  duration?: number;
  response?: number;
  curve?: 'spring' | 'ease';
  motionBlur?: MotionBlurOption;
}

interface SceneBase {
  id: string;
  duration: number;
  transition?: SceneTransition | false;
  atmosphere?: AtmospherePreset | false;
}

export interface HookSceneData extends SceneBase {
  type: 'hook';
  eyebrow?: string;
  title: string;
  body?: string;
}

export interface StatSceneData extends SceneBase {
  type: 'stat';
  title?: string;
  label: string;
  value: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta?: string;
}

export interface RankingSceneData extends SceneBase {
  type: 'ranking';
  title: string;
  data: readonly TickerStep[];
  highlight?: string;
}

export interface ComparisonSceneData extends SceneBase {
  type: 'comparison';
  title: string;
  left: {label: string; value: number};
  right: {label: string; value: number};
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export interface NeededVsEarnedSceneData extends SceneBase {
  type: 'neededVsEarned';
  title: string;
  data: ShortfallBarsData;
}

export interface TakeawaySceneData extends SceneBase {
  type: 'takeaway';
  title: string;
  body?: string;
  eyebrow?: string;
}

export interface EndCardSceneData extends SceneBase {
  type: 'endCard';
  title: string;
  subtitle?: string;
  actionLabel?: string;
}

export interface MapHeroSceneData extends SceneBase {
  type: 'mapHero';
  title: string;
  subtitle?: string;
  origin?: string;
  destination?: string;
}

export type SceneDefinition =
  | HookSceneData
  | StatSceneData
  | RankingSceneData
  | ComparisonSceneData
  | NeededVsEarnedSceneData
  | TakeawaySceneData
  | EndCardSceneData
  | MapHeroSceneData;

export interface SceneTransitionWindow extends SceneTransition {
  kind: TransitionKind;
  duration: number;
  start: number;
}

export interface ScenePlacement {
  scene: SceneDefinition;
  start: number;
  end: number;
  transition?: SceneTransitionWindow;
}

export interface SceneSequenceLayout {
  placements: readonly ScenePlacement[];
  duration: number;
}

export interface SceneSequenceOptions {
  transitionDuration?: number;
  transitionKind?: TransitionKind;
}

export interface SceneSequenceRenderOptions {
  atmosphere?: AtmospherePreset | false;
  finish?: FinishLevel;
  kitRender?: {profile?: string};
}
