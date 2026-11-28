import {readdirSync, readFileSync} from 'node:fs';
import {extname, join, relative} from 'node:path';

const sourceRoot = join(process.cwd(), 'src');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.css']);
const forbidden = [
  /\bDynamicIsland\b/i,
  /\bHomeIndicator\b/i,
  /\bStatusBar\b/i,
  /\bPhoneFrame\b/i,
  /\bDeviceFrame\b/i,
  /\bNotch\b/i,
  /\bCameraCutout\b/i,
  /\bdevice[\s_-]*chrome\b/i,
  /\bdevice[\s_-]*frame\b/i,
  /\bphone[\s_-]*frame\b/i,
  /\bstatus[\s-]*bar\b/i,
  /\bhome[\s-]*indicator\b/i,
  /\bcamera[\s-]*cutout\b/i,
  /\bbezel\b/i,
];

const filesUnder = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return filesUnder(path);
  return sourceExtensions.has(extname(path)) ? [path] : [];
});

const findings = [];
for (const path of filesUnder(sourceRoot)) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (forbidden.some((pattern) => pattern.test(line))) {
      findings.push(`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (findings.length) {
  console.error(`Forbidden device-style chrome references found (${findings.length}):\n${findings.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('No forbidden device-style chrome references found in src/.');
}
