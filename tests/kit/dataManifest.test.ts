import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {assertAllRegionsPresent, assertSumsTo, sourceLine, STATES_DC, type DataManifest} from '../../src/kit/data/manifest';

const entry = (over: Record<string, unknown> = {}) => ({id: 'cpi', file: 'cpi.csv', sourceName: 'BLS CPI', url: 'https://www.bls.gov/cpi/', retrievedDate: '2026-11-01', dataYear: 2025, units: 'medians', geography: 'US', notes: '', license: 'Public domain', sha256: '', ...over});
const project = (mut: (d: Record<string, unknown>) => void = () => {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kit-data-'));
  const csv = 'a,b\n1,2\n';
  writeFileSync(path.join(dir, 'cpi.csv'), csv);
  const d = entry({sha256: createHash('sha256').update(csv).digest('hex')});
  mut(d);
  writeFileSync(path.join(dir, 'data.manifest.json'), JSON.stringify({version: 1, datasets: [d]}));
  return dir;
};
const check = (dir: string, ...more: string[]) => spawnSync('node', ['scripts/kit_data_check.mjs', '--root', dir, '--today', '2026-11-28', ...more], {encoding: 'utf8'});

describe('data manifest helpers', () => {
  const m: DataManifest = {version: 1, datasets: [entry(), entry({id: 'oews', sourceName: 'BLS OEWS', dataYear: 2024, units: 'annual wages'})] as never};
  it('sourceLine', () => {
    expect(sourceLine('cpi', m)).toBe('Source: BLS CPI, 2025, medians');
    expect(sourceLine(['cpi', 'oews', 'cpi'], m)).toBe('Source: BLS CPI, 2025, medians; BLS OEWS, 2024, annual wages');
    expect(() => sourceLine('nope', m)).toThrow(/not in the data manifest/);
  });
  it('assertSumsTo', () => {
    expect(() => assertSumsTo([0.5, 0.25, 0.25], 1)).not.toThrow();
    expect(() => assertSumsTo([0.5, 0.25], 1, undefined, 'shares')).toThrow(/shares add up to 0.75/);
  });
  it('assertAllRegionsPresent', () => {
    expect(STATES_DC).toHaveLength(51);
    expect(() => assertAllRegionsPresent(Object.fromEntries(STATES_DC.map((s) => [s, 1])))).not.toThrow();
    expect(() => assertAllRegionsPresent(STATES_DC.filter((s) => s !== 'DC'))).toThrow(/missing DC/);
    expect(() => assertAllRegionsPresent([...STATES_DC, 'PR'])).toThrow(/unknown PR/);
  });
});

describe('kit:data-check', () => {
  it('passes a clean manifest', () => expect(check(project()).status).toBe(0));
  it('fails on a hash mismatch', () => { const r = check(project((d) => { d.sha256 = 'a'.repeat(64); })); expect(r.status).toBe(1); expect(r.stderr).toMatch(/sha256 mismatch/); });
  it('fails on a missing field', () => { const r = check(project((d) => { delete d.license; })); expect(r.status).toBe(1); expect(r.stderr).toMatch(/missing field "license"/); });
  it('warns (exit 0) when stale', () => { const r = check(project((d) => { d.retrievedDate = '2024-01-01'; })); expect(r.status).toBe(0); expect(r.stderr).toMatch(/warn/); });
  it('--stale-days changes the limit', () => expect(check(project(), '--stale-days', '5').stderr).toMatch(/warn/));
});
