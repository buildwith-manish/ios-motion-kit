/**
 * Pure helpers for the map scene types (no React, no Remotion): region ids, data validation, a CSV-row mapper, and the
 * timing math of regionHighlight and flyToCity. Everything is in seconds.
 */
import type {HighlightStep} from '../map/highlight';

export type MapLevel = 'states' | 'counties' | 'cbsa' | 'zcta';

export interface StateRow {fips: string; usps: string; name: string}

/** The 50 states and DC (US-only scope). */
export const US_STATES: readonly StateRow[] = [
  ['01', 'AL', 'Alabama'], ['02', 'AK', 'Alaska'], ['04', 'AZ', 'Arizona'], ['05', 'AR', 'Arkansas'], ['06', 'CA', 'California'],
  ['08', 'CO', 'Colorado'], ['09', 'CT', 'Connecticut'], ['10', 'DE', 'Delaware'], ['11', 'DC', 'District of Columbia'],
  ['12', 'FL', 'Florida'], ['13', 'GA', 'Georgia'], ['15', 'HI', 'Hawaii'], ['16', 'ID', 'Idaho'], ['17', 'IL', 'Illinois'],
  ['18', 'IN', 'Indiana'], ['19', 'IA', 'Iowa'], ['20', 'KS', 'Kansas'], ['21', 'KY', 'Kentucky'], ['22', 'LA', 'Louisiana'],
  ['23', 'ME', 'Maine'], ['24', 'MD', 'Maryland'], ['25', 'MA', 'Massachusetts'], ['26', 'MI', 'Michigan'], ['27', 'MN', 'Minnesota'],
  ['28', 'MS', 'Mississippi'], ['29', 'MO', 'Missouri'], ['30', 'MT', 'Montana'], ['31', 'NE', 'Nebraska'], ['32', 'NV', 'Nevada'],
  ['33', 'NH', 'New Hampshire'], ['34', 'NJ', 'New Jersey'], ['35', 'NM', 'New Mexico'], ['36', 'NY', 'New York'],
  ['37', 'NC', 'North Carolina'], ['38', 'ND', 'North Dakota'], ['39', 'OH', 'Ohio'], ['40', 'OK', 'Oklahoma'], ['41', 'OR', 'Oregon'],
  ['42', 'PA', 'Pennsylvania'], ['44', 'RI', 'Rhode Island'], ['45', 'SC', 'South Carolina'], ['46', 'SD', 'South Dakota'],
  ['47', 'TN', 'Tennessee'], ['48', 'TX', 'Texas'], ['49', 'UT', 'Utah'], ['50', 'VT', 'Vermont'], ['51', 'VA', 'Virginia'],
  ['53', 'WA', 'Washington'], ['54', 'WV', 'West Virginia'], ['55', 'WI', 'Wisconsin'], ['56', 'WY', 'Wyoming'],
].map(([fips, usps, name]) => ({fips, usps, name}));

const BY_FIPS = new Map(US_STATES.map((s) => [s.fips, s]));
const BY_USPS = new Map(US_STATES.map((s) => [s.usps, s]));
const squash = (s: string): string => s.toLowerCase().replace(/[.,']/g, '').replace(/\s+/g, ' ').trim();
const BY_NAME = new Map<string, StateRow>([
  ...US_STATES.map((s): [string, StateRow] => [squash(s.name), s]),
  ['washington dc', BY_FIPS.get('11')!], ['washington d c', BY_FIPS.get('11')!], ['dc', BY_FIPS.get('11')!],
  ['district columbia', BY_FIPS.get('11')!], ['washington state', BY_FIPS.get('53')!],
]);

/** The state row for a FIPS ('8', '08', 8), USPS code ('co') or name ('Colorado', 'Washington, D.C.'); null if unknown. */
export const stateRow = (input: string | number): StateRow | null => {
  if (typeof input === 'number') return Number.isInteger(input) ? BY_FIPS.get(String(input).padStart(2, '0')) ?? null : null;
  const s = input.trim();
  if (/^\d{1,2}$/.test(s)) return BY_FIPS.get(s.padStart(2, '0')) ?? null;
  if (/^[A-Za-z]{2}$/.test(s)) return BY_USPS.get(s.toUpperCase()) ?? null;
  return BY_NAME.get(squash(s)) ?? null;
};
/** Two-digit state FIPS for any common state form, or null. */
export const normalizeStateId = (input: string | number): string | null => stateRow(input)?.fips ?? null;

export type RegionValue = number | null;
export type RegionRecord = Record<string, RegionValue>;

const MAX_LISTED = 8;
const list = (items: readonly string[]): string => `${items.slice(0, MAX_LISTED).join(', ')}${items.length > MAX_LISTED ? `, +${items.length - MAX_LISTED} more` : ''}`;

const LEVEL_HINT: Record<MapLevel, string> = {
  states: 'a state FIPS ("08"), USPS code ("CO") or name ("Colorado")',
  counties: 'a five-digit county FIPS ("08031")',
  cbsa: 'a five-digit CBSA code ("19100")',
  zcta: 'a five-digit ZIP code area ("02116")',
};

/**
 * Normalises the keys of a {regionId: value} record to the ids of the baked layer (state FIPS, five-digit codes) and checks
 * the values. Throws one RangeError that names the scene and lists every problem. Missing values are null (hatched on the map).
 */
export const canonicalRegionData = (sceneId: string, level: MapLevel, data: Record<string, unknown>): RegionRecord => {
  const keys = Object.keys(data ?? {});
  if (!keys.length) throw new RangeError(`Scene "${sceneId}": data is empty. Pass {regionId: value} with ${LEVEL_HINT[level]} as the id.`);
  const out: RegionRecord = {};
  const unknown: string[] = [];
  const badValue: string[] = [];
  const duplicate: string[] = [];
  for (const key of keys) {
    let id: string | null;
    if (level === 'states') id = normalizeStateId(key);
    else id = /^\d{3,5}$/.test(key.trim()) ? key.trim().padStart(5, '0') : null;
    if (id === null) { unknown.push(key); continue; }
    const v = data[key];
    if (v !== null && v !== undefined && !(typeof v === 'number' && Number.isFinite(v))) { badValue.push(`${key}=${String(v)}`); continue; }
    if (id in out) { duplicate.push(key); continue; }
    out[id] = v === undefined ? null : (v as RegionValue);
  }
  const problems: string[] = [];
  if (unknown.length) problems.push(`unknown ${level} id(s): ${list(unknown)} (use ${LEVEL_HINT[level]})`);
  if (badValue.length) problems.push(`value is not a finite number or null: ${list(badValue)}`);
  if (duplicate.length) problems.push(`the same region appears twice: ${list(duplicate)}`);
  if (problems.length) throw new RangeError(`Scene "${sceneId}": ${problems.join('; ')}.`);
  if (!Object.values(out).some((v) => v !== null)) throw new RangeError(`Scene "${sceneId}": every value is null, so nothing would be coloured.`);
  return out;
};

/** Canonical id of one region for a level (a callout or highlight target), or null. */
export const canonicalRegionId = (level: MapLevel, id: string | number): string | null => {
  if (level === 'states') return normalizeStateId(id);
  const s = String(id).trim();
  return /^\d{3,5}$/.test(s) ? s.padStart(5, '0') : null;
};

const ID_COLUMNS = ['fips', 'state_fips', 'statefips', 'state_fips_code', 'geoid', 'usps', 'state_abbr', 'state_abbreviation', 'stusps', 'state_code', 'state', 'state_name', 'name', 'region'];

/** Parses "$1,234", "12.5%", "(5)", "−3" (typographic minus). Blank, "n/a", "na", "-", "—" give null; anything else throws. */
export const parseRegionNumber = (raw: unknown): RegionValue => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s === '' || /^(n\/?a|nan|null|-|\u2013|\u2014)$/i.test(s)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[\u2212\u2013]/g, '-').replace(/[$,%\s]/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new RangeError(`Cannot read "${String(raw)}" as a number`);
  return negative ? -n : n;
};

export interface RegionsFromRowsOptions {
  /** Column that holds the value. */
  value: string;
  /** Column that holds the state name / USPS code / FIPS (counties, CBSAs, ZIPs: the code). Default: the first of fips, state_fips, geoid, usps, state_abbr, state, state_name, name, region found. */
  id?: string;
  level?: MapLevel;
  /** 'throw' (default) lists every row it cannot map; 'skip' drops them. */
  onUnknown?: 'throw' | 'skip';
}

/**
 * CSV rows (already parsed to objects, header names as keys) to {regionId: value}. Accepts state names, USPS codes (incl.
 * DC) and FIPS with or without the leading zero. Missing values become null.
 */
export const regionsFromRows = (rows: readonly Record<string, unknown>[], opts: RegionsFromRowsOptions): RegionRecord => {
  const level = opts.level ?? 'states';
  if (!rows.length) throw new RangeError('regionsFromRows: no rows');
  const columns = Object.keys(rows[0]);
  const lower = new Map(columns.map((c) => [c.trim().toLowerCase(), c]));
  const idCol = opts.id ?? ID_COLUMNS.map((c) => lower.get(c)).find((c): c is string => c !== undefined);
  if (!idCol || !columns.includes(idCol)) throw new RangeError(`regionsFromRows: no id column. Columns are: ${columns.join(', ')}. Pass {id: '<column>'}.`);
  if (!columns.includes(opts.value)) throw new RangeError(`regionsFromRows: no value column "${opts.value}". Columns are: ${columns.join(', ')}.`);
  const out: RegionRecord = {};
  const unknown: string[] = [];
  rows.forEach((row, i) => {
    const raw = row[idCol];
    const id = canonicalRegionId(level, typeof raw === 'number' ? raw : String(raw ?? ''));
    if (id === null) { unknown.push(`row ${i + 1}: ${String(raw)}`); return; }
    if (id in out) throw new RangeError(`regionsFromRows: row ${i + 1} repeats region ${id}`);
    out[id] = parseRegionNumber(row[opts.value]);
  });
  if (unknown.length && (opts.onUnknown ?? 'throw') === 'throw') throw new RangeError(`regionsFromRows: cannot map ${list(unknown)} to a ${level} id`);
  return out;
};

export interface HighlightRegionInput {id: string; label?: string; value?: number; /** Seconds from the scene start. */ at?: number; /** Seconds this region stays lit. */ hold?: number}
export interface PlannedHighlight {id: string; at: number; until?: number}

const HIGHLIGHT_LEAD = 0.6;
const HIGHLIGHT_TAIL = 0.6;
const HIGHLIGHT_MIN_HOLD = 1.2;

/** When each region lights (scene-relative seconds). Regions without `at` follow one another; the last stays lit to the end. */
export const planHighlights = (sceneId: string, duration: number, regions: readonly HighlightRegionInput[]): PlannedHighlight[] => {
  if (!regions.length) throw new RangeError(`Scene "${sceneId}": regions is empty`);
  const auto = Math.max(HIGHLIGHT_MIN_HOLD, (duration - HIGHLIGHT_LEAD - HIGHLIGHT_TAIL) / regions.length);
  const plan = regions.map((r, i): PlannedHighlight => {
    const at = r.at ?? HIGHLIGHT_LEAD + i * auto;
    if (!Number.isFinite(at) || at < 0 || at >= duration) throw new RangeError(`Scene "${sceneId}": region "${r.id}" starts at ${at}s, outside 0..${duration}s`);
    const hold = r.hold ?? auto;
    if (!Number.isFinite(hold) || hold <= 0) throw new RangeError(`Scene "${sceneId}": region "${r.id}" hold must be positive`);
    return {id: r.id, at, until: at + hold};
  });
  const last = plan.length - 1;
  plan.forEach((p, i) => { if (i === last) p.until = undefined; else if ((p.until ?? 0) > plan[i + 1].at + 1e-9) p.until = plan[i + 1].at; });
  return plan;
};

/** HighlightStage steps (absolute seconds) for a scene that starts at `sceneStart`. `ids` are canonical region ids. */
export const highlightSteps = (sceneStart: number, plan: readonly PlannedHighlight[]): HighlightStep[] =>
  plan.map((p) => ({ids: [p.id], at: sceneStart + p.at, until: p.until === undefined ? undefined : sceneStart + p.until}));

/** Baked cities (the ten of data-manifest). Centres are the downtown points the street layer is baked around. */
export const BAKED_CITIES = {
  'new-york': {name: 'New York', cbsa: '35620', lat: 40.7128, lng: -74.006},
  'los-angeles': {name: 'Los Angeles', cbsa: '31080', lat: 34.0522, lng: -118.2437},
  chicago: {name: 'Chicago', cbsa: '16980', lat: 41.882, lng: -87.635},
  houston: {name: 'Houston', cbsa: '26420', lat: 29.7604, lng: -95.3698},
  phoenix: {name: 'Phoenix', cbsa: '38060', lat: 33.4484, lng: -112.074},
  philadelphia: {name: 'Philadelphia', cbsa: '37980', lat: 39.9526, lng: -75.1652},
  dallas: {name: 'Dallas', cbsa: '19100', lat: 32.7767, lng: -96.797},
  miami: {name: 'Miami', cbsa: '33100', lat: 25.7617, lng: -80.1918},
  atlanta: {name: 'Atlanta', cbsa: '12060', lat: 33.749, lng: -84.388},
  washington: {name: 'Washington, DC', cbsa: '47900', lat: 38.9072, lng: -77.0369},
} as const;
export type BakedCityId = keyof typeof BAKED_CITIES;
export const isBakedCity = (id: string): id is BakedCityId => Object.prototype.hasOwnProperty.call(BAKED_CITIES, id);

/** Half-width of the baked street box, km: pins and callouts must lie inside it. */
export const CITY_BOX_HALF_KM = 7;
export const kmFrom = (centre: {lat: number; lng: number}, p: {lat: number; lng: number}): {east: number; north: number} => ({
  east: (p.lng - centre.lng) * 111.32 * Math.cos((centre.lat * Math.PI) / 180),
  north: (p.lat - centre.lat) * 110.574,
});

export interface FlyTiming {
  /** Seconds from the scene start. */
  leadIn: number;
  /** Present when the country-scale beat (arc, country pins) is used. */
  country?: {duration: number; hold: number};
  metro: {duration: number; hold: number};
  /** Shortest scene that fits every beat. */
  minDuration: number;
}

const FLY = {lead: 0.4, countryLeg: 2.6, countryHold: 2.4, metroLeg: 3.6, metroHold: 2.4};

/** Camera timing of a flyToCity scene. Throws if the scene is too short for the beats it asks for. */
export const flyTiming = (sceneId: string, duration: number, withCountry: boolean): FlyTiming => {
  const minDuration = FLY.lead + (withCountry ? FLY.countryLeg + FLY.countryHold : 0) + FLY.metroLeg + FLY.metroHold;
  if (!Number.isFinite(duration) || duration + 1e-9 < minDuration) {
    throw new RangeError(`Scene "${sceneId}": flyToCity needs at least ${minDuration.toFixed(1)} s${withCountry ? ' with a country-scale beat (arc / countryPins)' : ''}; it has ${duration} s.`);
  }
  const spare = duration - minDuration;
  return {
    leadIn: FLY.lead,
    country: withCountry ? {duration: FLY.countryLeg, hold: FLY.countryHold} : undefined,
    metro: {duration: FLY.metroLeg, hold: FLY.metroHold + spare},
    minDuration,
  };
};

/** Minimal CSV reader (header row, comma separated, double-quoted fields with "" escapes). */
export const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw new RangeError('parseCsv: needs a header row and at least one data row');
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
};

/** CSV text to {regionId: value}: {@link parseCsv} then {@link regionsFromRows}. */
export const regionsFromCsv = (text: string, opts: RegionsFromRowsOptions): RegionRecord => regionsFromRows(parseCsv(text), opts);
