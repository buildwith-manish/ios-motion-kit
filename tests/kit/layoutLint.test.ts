import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const rulesPath = '../../scripts/kit_layout_lint_rules.mjs';
const load = async () => (await import(/* @vite-ignore */ rulesPath)) as {lintFrame: (f: unknown, c: unknown) => Array<{rule: string}>; checkConfig: (c: unknown) => Array<{rule: string}>};
const cfg = {...JSON.parse(readFileSync('scripts/kit_layout_lint.config.json', 'utf8')), frame: {width: 1920, height: 1080}};
const box = (l: number, t: number, w: number, h: number) => ({left: l, top: t, right: l + w, bottom: t + h});
const it1 = (role: string, b: ReturnType<typeof box>, size = 40, path = role) => ({role, path, label: role, box: b, size, opacity: 1, ignored: false});
const rules = async (frame: {texts?: unknown[]; items?: unknown[]}) => (await load()).lintFrame({texts: [], items: [], ...frame}, cfg).map((f) => f.rule).sort();

describe('layout lint rules', () => {
  it('default config: hero zone is >= 60% of the frame', async () => expect((await load()).checkConfig(cfg)).toEqual([]));
  it('clean frame', async () => expect(await rules({items: [it1('hero', box(200, 300, 900, 300), 160), it1('label', box(200, 700, 300, 60), 40)]})).toEqual([]));
  it('text under 28 px', async () => expect(await rules({texts: [{path: 'a', text: 'tiny', size: 24, opacity: 1, ignored: false}]})).toEqual(['text-floor']));
  it('label under 36, hero outside 120-200', async () => expect(await rules({items: [it1('label', box(200, 700, 300, 60), 30), it1('hero', box(200, 300, 900, 300), 220)]})).toEqual(['hero-size', 'label-min']));
  it('hero outside the hero zone', async () => expect(await rules({items: [it1('hero', box(1500, 60, 400, 200), 160)]})).toContain('hero-zone'));
  it('more than 3 secondary elements', async () => expect(await rules({items: [0, 1, 2, 3].map((i) => it1('secondary', box(100 + i * 300, 400, 200, 100), 40, `s${i}`))})).toEqual(['max-secondary']));
  it('rail / footer strip overlap', async () => expect(await rules({items: [it1('secondary', box(1300, 60, 300, 40), 40, 'a'), it1('secondary', box(300, 990, 300, 40), 40, 'b')]})).toEqual(['strip-overlap', 'strip-overlap']));
  it('two elements overlapping, but a nested child is fine', async () => {
    expect(await rules({items: [it1('secondary', box(300, 400, 300, 100), 40, 'a:0'), it1('chip', box(400, 420, 300, 100), 40, 'b:1')]})).toEqual(['overlap']);
    expect(await rules({items: [it1('secondary', box(300, 400, 300, 100), 40, 'a:0'), it1('label', box(310, 410, 100, 40), 40, 'a:0/b:0')]})).toEqual([]);
  });
  it('chips one at a time', async () => expect(await rules({items: [it1('chip', box(100, 400, 200, 80), 40, 'c1'), it1('chip', box(500, 400, 200, 80), 40, 'c2')]})).toEqual(['chips-one-at-a-time']));
});

describe('maxSimultaneous', () => {
  const sim = async (items: unknown[], c: unknown = cfg) => ((await import(/* @vite-ignore */ rulesPath)) as {checkMaxSimultaneous: (i: unknown[], c: unknown) => {skipped: boolean; findings: Array<{rule: string}>}}).checkMaxSimultaneous(items, c);
  const sec = (i: number, opacity = 1, role = 'secondary') => ({...it1(role, box(0, 0, 10, 10), 40, `s${i}`), opacity});
  it('default config key is 3', () => expect(cfg.maxSimultaneous).toBe(3));
  it('3 secondary is fine, 4 flags', async () => {
    expect((await sim([0, 1, 2].map((i) => sec(i)))).findings).toEqual([]);
    expect((await sim([0, 1, 2, 3].map((i) => sec(i)))).findings.map((f) => f.rule)).toEqual(['max-simultaneous']);
  });
  it('faint (opacity <= 0.5), hero, rail and footer do not count', async () => {
    const items = [sec(0), sec(1), sec(2), sec(3, 0.5), sec(4, 1, 'hero'), sec(5, 1, 'rail'), sec(6, 1, 'footer')];
    expect((await sim(items)).findings).toEqual([]);
  });
  it('honours a lower configured max', async () => expect((await sim([sec(0), sec(1)], {...cfg, maxSimultaneous: 1})).findings).toHaveLength(1));
  it('no roles: skipped with no findings', async () => expect(await sim([])).toEqual({skipped: true, findings: []}));
});
