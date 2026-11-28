import {describe, expect, it, vi} from 'vitest';

vi.setConfig({testTimeout: 60_000});
import {hasFfmpeg, hasNumpy, json, makeProject, py} from './pipelineFixture';

describe.skipIf(!hasNumpy)('pipeline core (python)', () => {
  it('vo_layout: shot = onset + speech + tail on whole frames, intro and chapter cards inserted, no overlaps', () => {
    const root = makeProject();
    const r = py('vo_layout.py', root);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const lay = json(root, 'src/audio/vo-layout.json');
    const ids = lay.sections.map((s: {id: string}) => s.id);
    expect(ids).toEqual(['coldOpen', 'intro', 'chapter1', 'method', 'chapter2', 'outro']);
    const [a, b, c] = lay.shots;
    expect(a.start).toBe(0);
    expect(Math.abs(a.seconds - 2.4)).toBeLessThanOrEqual(1 / 30 + 1e-6); // 0.1 + 2.0 + 0.3, rounded up to a frame
    expect(b.start).toBeCloseTo(a.seconds, 4);
    // intro 2 s + chapter card 1 s sit between the cold open and the method
    expect(c.start).toBeCloseTo(b.start + b.seconds + 2 + 1, 3);
    for (const s of lay.shots) expect(Math.abs(s.seconds * 30 - Math.round(s.seconds * 30))).toBeLessThan(2e-3); // layout rounds to 4 decimals
    const last = lay.shots[lay.shots.length - 1];
    expect(lay.totalSeconds).toBeGreaterThanOrEqual(last.start + last.seconds - 1e-6);
    expect(lay.endScreenSeconds).toBe(2);
    const man = json(root, 'src/audio/voiceover-manifest.json');
    expect(man).toHaveLength(5);
    expect(man[0].file).toBe('voiceover/clips_wav/001_s01a.wav');
    // the clip file starts so that its first word lands `onset` after the shot start
    expect(man[0].startFrame / 30).toBeCloseTo(0.1 - 0.05, 1);
  });

  it('vo_layout --check writes nothing and fails on a missing clip', () => {
    const root = makeProject(false);
    const r = py('vo_layout.py', root, '--check');
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('missing clip 001_s01a.wav');
  });

  it('vo_layout flags a clip that is too fast for its words (truncated)', () => {
    const root = makeProject();
    const fs = require('node:fs');
    fs.writeFileSync(`${root}/scripts/lines.csv`, 'id,text\ns01a,one two three four five six seven eight nine ten eleven twelve thirteen fourteen\ns01b,x\ns02a,x\ns03a,x\ns03b,x\n');
    const r = py('vo_layout.py', root, '--check');
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('probably truncated');
  });

  it('vo_envelope: speaking frames are high, the gap at the end is low', () => {
    const root = makeProject();
    expect(py('vo_layout.py', root).status).toBe(0);
    const r = py('vo_envelope.py', root);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const env = json(root, 'src/audio/vo-envelope.json');
    expect(env.fps).toBe(30);
    expect(env.frames[30]).toBeGreaterThan(90); // 1 s: first clip is speaking
    expect(env.frames[env.frames.length - 1]).toBeLessThan(10);
    expect(Math.max(...env.frames)).toBeLessThanOrEqual(100);
  });

  it('pace_audit lists shots longer than the limit and exits 0', () => {
    const root = makeProject();
    py('vo_layout.py', root);
    const r = py('pace_audit.py', root, '--limit', '1.8');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('longer than 1.8s');
    expect(r.stdout).toMatch(/s01a\s+speech\s+2\.0s/);
  });

  it('rejects an invalid config with a readable message', () => {
    const root = makeProject();
    require('node:fs').writeFileSync(`${root}/video.config.json`, '{"fps": 0, "nope": 1}');
    const r = py('vo_layout.py', root, '--check');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('config.fps: must be >= 1');
    expect(r.stderr).toContain('config.nope: unknown key');
  });

  it.skipIf(!hasFfmpeg)('normalize_vo --check reads the clip levels', () => {
    const root = makeProject();
    const r = py('normalize_vo.py', root, '--check');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/001_s01a\.wav\s+-?\d+\.\d LUFS/);
  });
});
