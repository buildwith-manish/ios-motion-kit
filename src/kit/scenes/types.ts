import type {FormatPresetName, FormatSpec} from '../text/format';
import type {AtmospherePreset} from '../background';
import type {ShortfallBarsData, TickerStep} from '../dataviz';
import type {FinishLevel} from '../finish';
import type {TransitionKind, MotionBlurOption} from '../transitions';
import type {ChoroplethOrder} from '../map/choroplethTiming';
import type {BakedCityId, HighlightRegionInput, MapLevel} from './regionData';

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
  /** Preset name or spec (kit/text/format). */
  format?: FormatPresetName | FormatSpec;
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
  /** Preset name or spec (kit/text/format). */
  format?: FormatPresetName | FormatSpec;
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

/** A callout anchored to a region (state / county / CBSA / ZIP id in any accepted form). Shows the label and the region's value. */
export interface RegionCalloutData {
  region: string;
  /** Default: the region's name from the baked layer. */
  label?: string;
}

export interface ChoroplethSceneData extends SceneBase {
  type: 'choropleth';
  title: string;
  subtitle?: string;
  /** Default 'states'. */
  level?: MapLevel;
  /** counties: a state (FIPS, USPS or name) to zoom to; zcta: the CBSA code of a baked zcta-metro file (required). */
  scope?: string;
  /** {regionId: value}; null marks a missing value (hatched). State keys may be FIPS, USPS code or name. */
  data: Record<string, number | null>;
  scale?: 'sequential' | 'diverging';
  /** sequential [min, max]; diverging [min, mid, max]. Default: from the data. */
  domain?: number[];
  /** Preset name or spec (kit/text/format) for the legend and callouts. Default 'int'. */
  format?: FormatPresetName | FormatSpec;
  legendTitle?: string;
  /** Credit line under the map. Omitted: none is drawn. */
  source?: string;
  callouts?: readonly RegionCalloutData[];
  /** Fill-in timing in seconds from the scene start. */
  reveal?: {start?: number; spread?: number; order?: ChoroplethOrder};
  /** Slow push-in: the map scales from 1 to `to` over the scene (default 1.04; 1 turns it off). */
  camera?: {to?: number};
}

export interface TileGridSceneData extends SceneBase {
  type: 'tileGrid';
  title: string;
  subtitle?: string;
  /** {state: value}; keys may be FIPS, USPS code or name (DC included); null marks a missing value (hatched). */
  data: Record<string, number | null>;
  scale?: 'sequential' | 'diverging';
  domain?: number[];
  format?: FormatPresetName | FormatSpec;
  legendTitle?: string;
  source?: string;
  /** Print the value on each tile when tiles are large enough. Default true. */
  values?: boolean;
  /** Fill-in timing in seconds from the scene start. */
  reveal?: {start?: number; spread?: number; order?: ChoroplethOrder};
}

export interface RegionHighlightSceneData extends SceneBase {
  type: 'regionHighlight';
  title: string;
  subtitle?: string;
  /** Default 'states'. */
  level?: Exclude<MapLevel, 'zcta'>;
  /** counties: a state to zoom to. */
  scope?: string;
  /** Handed over one by one. `at` / `hold` are seconds from the scene start; omitted, they follow in order. */
  regions: readonly HighlightRegionInput[];
  format?: FormatPresetName | FormatSpec;
  source?: string;
  /** Tilt of the map in degrees (kit default 6; 0 turns the 3D mount off). */
  tilt?: number;
}

export interface FlyCalloutData {
  lat: number;
  lng: number;
  title: string;
  value?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Seconds after the camera lands (default: staggered 1.2 s, 1.5 s, ...). */
  at?: number;
}

export interface FlyToCitySceneData extends SceneBase {
  type: 'flyToCity';
  title: string;
  subtitle?: string;
  /** One of the ten baked cities. */
  city: BakedCityId;
  /** Country-scale beat before the dive: pins, an arc between two places, callouts. Omit all to fly straight in. */
  countryPins?: readonly {lat: number; lng: number; label?: string}[];
  arc?: {from: {lat: number; lng: number}; to: {lat: number; lng: number}};
  countryCallouts?: readonly FlyCalloutData[];
  /** City scale (inside the 14 km baked box around the city centre). */
  pins?: readonly {lat: number; lng: number; label?: string}[];
  route?: readonly {lat: number; lng: number}[];
  callouts?: readonly FlyCalloutData[];
  source?: string;
}

export type SceneDefinition =
  | HookSceneData
  | StatSceneData
  | RankingSceneData
  | ComparisonSceneData
  | NeededVsEarnedSceneData
  | TakeawaySceneData
  | EndCardSceneData
  | MapHeroSceneData
  | ChoroplethSceneData
  | RegionHighlightSceneData
  | TileGridSceneData
  | FlyToCitySceneData;

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
