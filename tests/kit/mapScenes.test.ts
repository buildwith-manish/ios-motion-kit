import {describe, expect, it} from 'vitest';
import {TILE_GRID_CELLS, TILE_GRID_COLS, TILE_GRID_ROWS, tileGridLayout, inkOn} from '../../src/kit/map/tileGridLayout';
import {MAP_SCENES_DEMO_SCENES, SAMPLE_RENT} from '../../src/kit/scenes/mapScenesDemoData';
import {
  BAKED_CITIES, US_STATES, canonicalRegionData, flyTiming, highlightSteps, layoutSceneSequence, normalizeStateId, parseRegionNumber,
  planHighlights, regionsFromCsv, regionsFromRows, validateMapScene, type SceneDefinition,
} from '../../src/kit/scenes';

describe('state ids', () => {
  it('has 50 states plus DC exactly once', () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES.map((s) => s.fips)).size).toBe(51);
    expect(new Set(US_STATES.map((s) => s.usps)).size).toBe(51);
  });
  it('accepts FIPS, USPS and names, with DC forms', () => {
    for (const v of ['8', '08', 8, 'co', 'CO', 'Colorado', ' colorado ']) expect(normalizeStateId(v)).toBe('08');
    for (const v of ['DC', 'dc', 'D.C.', 'District of Columbia', 'Washington, D.C.', 'Washington DC', 11, '11']) expect(normalizeStateId(v)).toBe('11');
    expect(normalizeStateId('Washington')).toBe('53');
    expect(normalizeStateId('WA')).toBe('53');
    expect(normalizeStateId('Puerto Rico')).toBeNull();
    expect(normalizeStateId('PR')).toBeNull();
    expect(normalizeStateId('99')).toBeNull();
  });
});

describe('canonicalRegionData', () => {
  it('maps mixed state keys to FIPS and keeps null as missing', () => {
    expect(canonicalRegionData('s', 'states', {CO: 1, Texas: 2, '11': null})).toEqual({'08': 1, '48': 2, '11': null});
  });
  it('lists every unknown id with an actionable message', () => {
    expect(() => canonicalRegionData('s', 'states', {Narnia: 1, CO: 2, Atlantis: 3})).toThrow(/Scene "s".*unknown states id\(s\): Narnia, Atlantis.*USPS code/);
  });
  it('rejects empty data, all-null data, bad values and duplicates', () => {
    expect(() => canonicalRegionData('s', 'states', {})).toThrow(/data is empty/);
    expect(() => canonicalRegionData('s', 'states', {CO: null})).toThrow(/every value is null/);
    expect(() => canonicalRegionData('s', 'states', {CO: '5' as unknown as number})).toThrow(/not a finite number/);
    expect(() => canonicalRegionData('s', 'states', {CO: 1, '08': 2})).toThrow(/twice/);
  });
  it('pads county codes that lost their leading zero and rejects non-codes', () => {
    expect(canonicalRegionData('c', 'counties', {'1001': 3, '08031': 4})).toEqual({'01001': 3, '08031': 4});
    expect(() => canonicalRegionData('c', 'counties', {Denver: 1})).toThrow(/five-digit county FIPS/);
  });
});

describe('regionsFromRows / regionsFromCsv', () => {
  it('maps names, USPS codes and FIPS and parses formatted numbers', () => {
    const out = regionsFromRows([{State: 'Colorado', Value: '$1,234'}, {State: 'tx', Value: '12.5%'}, {State: 'Washington, D.C.', Value: '(5)'}, {State: '1', Value: 'n/a'}], {value: 'Value'});
    expect(out).toEqual({'08': 1234, '48': 12.5, '11': -5, '01': null});
  });
  it('finds the id column and explains when it cannot', () => {
    expect(regionsFromRows([{usps: 'CA', x: 3}], {value: 'x'})).toEqual({'06': 3});
    expect(() => regionsFromRows([{foo: 'CA', x: 3}], {value: 'x'})).toThrow(/no id column.*foo, x/);
    expect(() => regionsFromRows([{usps: 'CA', x: 3}], {value: 'y'})).toThrow(/no value column "y"/);
  });
  it('lists unmapped rows, or skips them on request', () => {
    const rows = [{state: 'CA', v: 1}, {state: 'Narnia', v: 2}];
    expect(() => regionsFromRows(rows, {value: 'v'})).toThrow(/row 2: Narnia/);
    expect(regionsFromRows(rows, {value: 'v', onUnknown: 'skip'})).toEqual({'06': 1});
  });
  it('reads CSV text with quotes and a BOM', () => {
    const csv = '\uFEFFstate_name,rate\n"Colorado",5.5\n"Washington, D.C.","1,250"\n';
    expect(regionsFromCsv(csv, {value: 'rate'})).toEqual({'08': 5.5, '11': 1250});
    expect(regionsFromCsv('state_fips,rate\n08,5.5\n11,7\n', {value: 'rate'})).toEqual({'08': 5.5, '11': 7});
  });
  it('parses numbers', () => {
    expect(parseRegionNumber('\u22123.5')).toBe(-3.5);
    expect(parseRegionNumber('\u2014')).toBeNull();
    expect(() => parseRegionNumber('abc')).toThrow(/Cannot read/);
  });
});

describe('timing math', () => {
  it('spreads regions evenly and keeps the last lit to the end', () => {
    const plan = planHighlights('h', 10, [{id: '08'}, {id: '29'}, {id: '13'}]);
    expect(plan.map((p) => p.at)).toEqual([0.6, 0.6 + 8.8 / 3, 0.6 + (2 * 8.8) / 3].map((v) => expect.closeTo(v, 6)));
    expect(plan[0].until).toBeCloseTo(plan[1].at, 6);
    expect(plan[2].until).toBeUndefined();
  });
  it('honours explicit starts, clips overlaps, and offsets by the scene start', () => {
    const plan = planHighlights('h', 10, [{id: 'a', at: 1, hold: 5}, {id: 'b', at: 3}]);
    expect(plan[0].until).toBe(3);
    expect(highlightSteps(20, plan)[1]).toEqual({ids: ['b'], at: 23, until: undefined});
    expect(() => planHighlights('h', 10, [{id: 'a', at: 12}])).toThrow(/outside 0..10s/);
    expect(() => planHighlights('h', 10, [])).toThrow(/regions is empty/);
  });
  it('flyTiming needs enough seconds for the beats it asks for', () => {
    expect(flyTiming('f', 6.4, false).minDuration).toBeCloseTo(6.4, 6);
    expect(flyTiming('f', 11.4, true).country).toBeDefined();
    expect(() => flyTiming('f', 8, true)).toThrow(/at least 11\.4 s/);
    expect(flyTiming('f', 10, false).metro.hold).toBeCloseTo(2.4 + 3.6, 6);
  });
});

describe('scene validation', () => {
  const base = {transition: false as const};
  it('is wired into layoutSceneSequence', () => {
    const bad: SceneDefinition = {id: 'm', type: 'choropleth', duration: 5, title: 'x', data: {Narnia: 1}, ...base};
    expect(() => layoutSceneSequence([bad])).toThrow(/Scene "m".*unknown states id/);
  });
  it('checks scope, domain, callouts and camera of choropleth', () => {
    const ok = {id: 'c', type: 'choropleth', duration: 5, title: 't', data: {CO: 1, TX: 2}, ...base} as const;
    expect(() => validateMapScene(ok)).not.toThrow();
    expect(() => validateMapScene({...ok, level: 'zcta', data: {'02116': 1}})).toThrow(/needs scope/);
    expect(() => validateMapScene({...ok, scope: 'CO'})).toThrow(/only supported/);
    expect(() => validateMapScene({...ok, scale: 'diverging', domain: [-1, 1]})).toThrow(/3 increasing numbers/);
    expect(() => validateMapScene({...ok, callouts: [{region: 'Narnia'}]})).toThrow(/callout region/);
    expect(() => validateMapScene({...ok, camera: {to: 2}})).toThrow(/between 1 and 1.3/);
  });
  it('checks highlight regions and flyToCity pins against the baked box', () => {
    const h = {id: 'h', type: 'regionHighlight', duration: 8, title: 't', regions: [{id: 'CO'}, {id: 'texas'}], ...base} as const;
    expect(() => validateMapScene(h)).not.toThrow();
    expect(() => validateMapScene({...h, regions: [{id: 'CO'}, {id: '08'}]})).toThrow(/listed twice/);
    const f = {id: 'f', type: 'flyToCity', duration: 8, title: 't', city: 'chicago', ...base} as const;
    expect(() => validateMapScene(f)).not.toThrow();
    expect(() => validateMapScene({...f, city: 'boston' as never})).toThrow(/is not baked/);
    expect(() => validateMapScene({...f, pins: [{lat: 41.9, lng: -87.6}]})).not.toThrow();
    expect(() => validateMapScene({...f, pins: [{lat: 42.5, lng: -87.6}]})).toThrow(/baked street box/);
    expect(() => validateMapScene({...f, duration: 6})).toThrow(/at least 6\.4 s/);
    expect(() => validateMapScene({...f, arc: {from: BAKED_CITIES['los-angeles'], to: BAKED_CITIES['new-york']}})).toThrow(/at least 11\.4 s/);
  });
});

describe('tileGrid', () => {
  it('has every state and DC exactly once, on unique in-bounds cells', () => {
    const ids = Object.keys(TILE_GRID_CELLS).sort();
    expect(ids).toEqual(US_STATES.map((s) => s.usps).sort());
    const cells = Object.values(TILE_GRID_CELLS).map(([c, r]) => `${c},${r}`);
    expect(new Set(cells).size).toBe(51);
    for (const [c, r] of Object.values(TILE_GRID_CELLS)) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThan(TILE_GRID_COLS); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(TILE_GRID_ROWS); }
  });
  it('lays tiles out square, non-overlapping, centred inside the box', () => {
    for (const box of [{x0: 96, y0: 240, x1: 1200, y1: 1000}, {x0: 65, y0: 400, x1: 1015, y1: 1100}]) {
      const l = tileGridLayout(box);
      expect(l.tiles).toHaveLength(51);
      for (const t of l.tiles) {
        expect(t.x).toBeGreaterThanOrEqual(box.x0 - 1e-6); expect(t.y).toBeGreaterThanOrEqual(box.y0 - 1e-6);
        expect(t.x + t.size).toBeLessThanOrEqual(box.x1 + 1e-6); expect(t.y + t.size).toBeLessThanOrEqual(box.y1 + 1e-6);
      }
      for (let i = 0; i < l.tiles.length; i++) for (let j = i + 1; j < l.tiles.length; j++) {
        const a = l.tiles[i], b = l.tiles[j];
        const overlap = a.x < b.x + b.size - 1e-6 && b.x < a.x + a.size - 1e-6 && a.y < b.y + b.size - 1e-6 && b.y < a.y + a.size - 1e-6;
        expect(overlap).toBe(false);
      }
      expect(l.x0 - box.x0).toBeCloseTo(box.x1 - (l.x0 + l.width) , 6);
    }
    expect(() => tileGridLayout({x0: 0, y0: 0, x1: 0, y1: 10})).toThrow(/positive size/);
  });
  it('picks readable ink', () => { expect(inkOn('#ffffff')).toBe('#0b0f14'); expect(inkOn('#000000')).toBe('#ffffff'); });
  it('validates scenes and lays them in a sequence', () => {
    const ok: SceneDefinition = {id: 't', type: 'tileGrid', duration: 6, title: 'T', data: {CO: 1, Texas: 2, DC: null}};
    expect(() => validateMapScene(ok)).not.toThrow();
    expect(() => validateMapScene({...ok, data: {Narnia: 1}} as SceneDefinition)).toThrow(/Scene "t"/);
    expect(() => validateMapScene({...ok, domain: [3, 1]} as SceneDefinition)).toThrow(/domain/);
    expect(() => layoutSceneSequence([ok])).not.toThrow();
  });
});

describe('map scenes demo video', () => {
  it('has valid scenes covering all 51 states, and lays out in landscape fps terms', () => {
    expect(Object.keys(SAMPLE_RENT)).toHaveLength(51);
    expect(canonicalRegionData('d', 'states', SAMPLE_RENT)).toBeTruthy();
    for (const s of MAP_SCENES_DEMO_SCENES) validateMapScene(s);
    expect(MAP_SCENES_DEMO_SCENES.map((s) => s.type)).toEqual(['hook', 'choropleth', 'regionHighlight', 'tileGrid', 'flyToCity', 'takeaway', 'endCard']);
    expect(layoutSceneSequence(MAP_SCENES_DEMO_SCENES).duration).toBeGreaterThan(40);
  });
});
