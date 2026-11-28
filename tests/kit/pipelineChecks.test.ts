import {describe, expect, it, vi} from 'vitest';

vi.setConfig({testTimeout: 60_000});
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {hasNumpy, json, makeProject, mjs, py} from './pipelineFixture';

const setLines = (root: string, csv: string) => writeFileSync(path.join(root, 'scripts/lines.csv'), `id,text\n${csv}\n`);

describe('figures-check', () => {
  it('matches spoken figures to the data (entities, global fields, allow-list)', () => {
    const root = makeProject(false);
    const r = mjs('figures_check.mjs', root);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/\$2000\s+money\s+OK\s+Chicago\.rent/);
    expect(r.stdout).toMatch(/40%\s+percent\s+OK\s+Chicago\.share/);
    expect(r.stdout).toMatch(/\b10\s+count\s+OK\s+count/);
    expect(r.stdout).toMatch(/\b1\s+count\s+ALLOWED/);
    expect(r.stdout).toContain('MISMATCH 0 | UNMATCHED 0');
  });
  it('exit 1 when the figure belongs to another entity than the one the line names', () => {
    const root = makeProject(false);
    setLines(root, 'a1,Miami rent is two thousand dollars.');
    const r = mjs('figures_check.mjs', root);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/MISMATCH a1: \$2000/);
  });
  it('exit 2 when no data field has the figure; digits and cents are read', () => {
    const root = makeProject(false);
    setLines(root, 'a1,"Chicago rent is $2,000."\na2,Then seven hundred dollars appear.\na3,Share is 40.0% or 3.5 here.');
    const r = mjs('figures_check.mjs', root);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/UNMATCHED a2: \$700/);
    expect(r.stdout).toMatch(/a1\s+\$2000\s+money\s+OK/);
  });
  it('rejects unknown options and bad config', () => {
    const root = makeProject(false);
    expect(mjs('figures_check.mjs', root, '--nope').status).toBe(1);
    writeFileSync(path.join(root, 'video.config.json'), '{"figures": {"entities": 5}}');
    const r = mjs('figures_check.mjs', root);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('config.figures.entities: expected string/null');
  });
});

describe.skipIf(!hasNumpy)('chapters', () => {
  it('builds m:ss lines from the layout and fails when a chapter is under 10 s', () => {
    const root = makeProject();
    expect(py('vo_layout.py', root).status).toBe(0);
    const r = mjs('chapters.mjs', root);
    // fixture: 0:00 Intro runs ~7 s before the first chapter card
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/chapter "Intro" is \d+\.\d s long/);
    const txt = readFileSync(path.join(root, 'docs/youtube-chapters.txt'), 'utf8').split('\n');
    expect(txt[0]).toBe('0:00 Intro');
    expect(txt[1]).toMatch(/^0:0\d The method$/);
  });
  it('passes with one 0:00 chapter longer than 10 s (3-chapter rule is only a warning) and --check re-reads the file', () => {
    const root = makeProject();
    py('vo_layout.py', root);
    writeFileSync(path.join(root, 'video.config.json'), JSON.stringify({...json(root, 'video.config.json'), chapters: [{section: 'coldOpen', title: 'Start', card: false}]}));
    const r = mjs('chapters.mjs', root);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain('YouTube needs at least 3 chapters');
    expect(mjs('chapters_check.mjs', root).status).toBe(0);
    writeFileSync(path.join(root, 'docs/youtube-chapters.txt'), '0:05 Start\n');
    const bad = mjs('chapters_check.mjs', root);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('first chapter must start at 0:00');
  });
});

describe.skipIf(!hasNumpy)('dump-cues and dry runs', () => {
  it('dump_cues writes seconds, tags and sorted cues', () => {
    const root = makeProject();
    py('vo_layout.py', root);
    const r = mjs('dump_cues.mjs', root);
    expect(r.status, r.stderr).toBe(0);
    const d = json(root, 'scripts/cues.json');
    expect(d.cues.map((c: {sfx: string}) => c.sfx)).toEqual(['pop', 'tap']);
    expect(d.cues[0]).toMatchObject({t: 1, gain: 0.8, hero: false, tag: 'coldOpen'});
    expect(d.cues[1]).toMatchObject({t: 5, hero: true});
    expect(d.shots.coldOpen).toBe(0);
  });
  it('contact-sheet and scene-stills --dry-run print the frame plan without rendering', () => {
    const root = makeProject();
    py('vo_layout.py', root);
    const c = mjs('contact_sheet.mjs', root, '--dry-run', '--only=s01a,s02a');
    expect(c.status, c.stderr).toBe(0);
    expect(c.stdout).toMatch(/s01a: frame 73 \(0:01\)/); // middle of a 2.4 s shot, canvas fps 60
    expect(c.stdout).toContain('2 frames, 2 sheet(s)');
    const s = mjs('scene_stills.mjs', root, '--dry-run');
    expect(s.status, s.stderr).toBe(0);
    expect(s.stdout).toContain('open start: 0.00 s = frame 0');
    expect(s.stdout).toMatch(/open rent: \d\.\d\d s = frame \d+/);
    expect(mjs('contact_sheet.mjs', root, '--dry-run', '--only=nope').status).toBe(1);
  });
});
