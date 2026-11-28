import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

export const REPO = path.resolve(__dirname, '../..');
export const FIXTURE = path.join(REPO, 'tests/fixtures/pipeline');
/** [clip name, speech seconds] in script order; every clip has 0.05 s of silence before and 0.15 s after the tone. */
export const CLIPS: [string, number][] = [['001_s01a', 2.0], ['002_s01b', 2.0], ['003_s02a', 1.5], ['004_s03a', 1.5], ['005_s03b', 2.0]];

/** Mono 16-bit PCM wav with a sine tone (no external files, no randomness). */
export const sineWav = (speech: number, sr = 24000, lead = 0.05, tail = 0.15): Buffer => {
  const n = Math.round((lead + speech + tail) * sr);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  const a = Math.round(lead * sr), z = a + Math.round(speech * sr);
  for (let i = 0; i < n; i++) b.writeInt16LE(i >= a && i < z ? Math.round(0.5 * 32767 * Math.sin((2 * Math.PI * 220 * i) / sr)) : 0, 44 + i * 2);
  return b;
};

/** A temp copy of the fixture project with synthetic clips in public/voiceover/clips_wav. */
export const makeProject = (withClips = true): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pipeline-'));
  cpSync(FIXTURE, dir, {recursive: true});
  if (withClips) {
    const d = path.join(dir, 'public/voiceover/clips_wav');
    mkdirSync(d, {recursive: true});
    for (const [name, s] of CLIPS) writeFileSync(path.join(d, `${name}.wav`), sineWav(s));
  }
  return dir;
};

export const run = (cmd: string, args: string[]) => spawnSync(cmd, args, {cwd: REPO, encoding: 'utf8'});
export const py = (tool: string, root: string, ...more: string[]) => run('python3', [`scripts/pipeline/${tool}`, '--root', root, ...more]);
export const mjs = (tool: string, root: string, ...more: string[]) => run('node', [`scripts/pipeline/${tool}`, '--root', root, ...more]);
export const hasNumpy = spawnSync('python3', ['-c', 'import numpy'], {encoding: 'utf8'}).status === 0;
export const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {encoding: 'utf8'}).status === 0;
export const json = (root: string, rel: string) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
export {existsSync};
