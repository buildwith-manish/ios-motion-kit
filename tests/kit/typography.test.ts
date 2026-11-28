import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {INTER_700, measureText, numberSize} from '../../src/kit/text';
import {KIT_FONT_FILES, kitFontCheckSpecs, kitFontError, kitFontLabel} from '../../src/kit/tokens/fonts';
import {TYPE_SCALE, midnight, typeScaleOf} from '../../src/kit/tokens';

const lint = JSON.parse(readFileSync('scripts/kit_layout_lint.config.json', 'utf8')) as {minText: number; minLabel: number; hero: {min: number; max: number}};
const rulesPath = '../../scripts/kit_font_check.mjs';
const load = async () => (await import(/* @vite-ignore */ rulesPath)) as {fontProblems: (s: unknown, o?: unknown) => string[]};

describe('type scale', () => {
  it('has the eight roles with sizes inside [min, max]', () => {
    expect(Object.keys(TYPE_SCALE).sort()).toEqual(['caption', 'figure', 'footnote', 'hero', 'label', 'number', 'stat', 'title']);
    for (const t of Object.values(TYPE_SCALE)) { expect(t.size).toBeGreaterThanOrEqual(t.min); expect(t.size).toBeLessThanOrEqual(t.max); }
  });
  it('respects the layout-lint minimums', () => {
    for (const t of Object.values(TYPE_SCALE)) expect(t.min).toBeGreaterThanOrEqual(lint.minText);
    expect(TYPE_SCALE.label.min).toBeGreaterThanOrEqual(lint.minLabel);
    expect(TYPE_SCALE.hero.min).toBeGreaterThanOrEqual(lint.hero.min);
    expect(TYPE_SCALE.hero.max).toBeLessThanOrEqual(lint.hero.max);
  });
  it('is exposed by the theme and leaves the old roles alone', () => {
    expect(typeScaleOf(midnight)).toBe(TYPE_SCALE);
    expect(midnight.type.caption.size).toBe(24);
    expect(midnight.type.number.size).toBe(88);
  });
});

describe('numberSize', () => {
  it('returns max when it fits, shrinks when it does not, never leaves [min, max]', () => {
    expect(numberSize('$1', 2000, {min: 120, max: 200})).toBe(200);
    const s = numberSize('$1,234,567.89', 900, {min: 120, max: 200});
    expect(s).toBeGreaterThanOrEqual(120);
    expect(s).toBeLessThan(200);
    expect(measureText('$1,234,567.89', s, INTER_700, -0.02) * 1.03).toBeLessThanOrEqual(900 + 1e-6);
    expect(numberSize('$1,234,567.89', 10, {min: 120, max: 200})).toBe(120);
  });
  it('is monotonic in width and in text length', () => {
    expect(numberSize('$12,400', 1200, {min: 80, max: 200})).toBeGreaterThanOrEqual(numberSize('$12,400', 800, {min: 80, max: 200}));
    expect(numberSize('$12,400', 900, {min: 80, max: 200})).toBeGreaterThanOrEqual(numberSize('$1,212,400', 900, {min: 80, max: 200}));
  });
});

describe('font loading (pure parts)', () => {
  it('labels name family, weight and subset', () => {
    expect(KIT_FONT_FILES.map(kitFontLabel)).toEqual(['Inter 600 latin', 'Inter 600 latin-ext', 'Inter 700 latin', 'Inter 700 latin-ext']);
    expect(kitFontCheckSpecs()).toEqual(['600 16px "Inter"', '700 16px "Inter"']);
  });
  it('errors name the font and file', () => {
    const e = kitFontError(KIT_FONT_FILES[2], new Error('boom'));
    expect(e.message).toContain('Inter 700 latin');
    expect(e.message).toContain('inter-latin-700-normal.woff2');
    expect(e.message).toContain('boom');
  });
  it('fontProblems passes loaded Inter and flags fallbacks', async () => {
    const {fontProblems} = await load();
    const faces = [600, 700].map((w) => ({family: 'Inter', weight: String(w), status: 'loaded'}));
    expect(fontProblems({faces, used: [{family: 'Inter', weight: '700', count: 3, sample: 'x', loaded: true}]})).toEqual([]);
    expect(fontProblems({faces: [], used: []}).length).toBeGreaterThan(0);
    expect(fontProblems({faces: [{family: 'Inter', weight: '600', status: 'loaded'}, {family: 'Inter', weight: '700', status: 'error'}], used: []}).join('|')).toContain('Inter 700');
    expect(fontProblems({faces, used: [{family: 'Arial', weight: '400', count: 1, sample: 'x', loaded: true}]}).join('|')).toContain('Arial');
    expect(fontProblems({faces, used: [{family: 'Arial', weight: '400', count: 1, sample: 'x', loaded: true}]}, {allowFamilies: ['Arial']})).toEqual([]);
  });
});
