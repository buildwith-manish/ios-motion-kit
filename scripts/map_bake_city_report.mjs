#!/usr/bin/env node
/** Collects public/kit/map/cities/*.report.json into cities/credits.json and docs/kit-map-city-bake-table.md (size + path counts per class). */
import {readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(ROOT, 'public/kit/map/cities');
const reps = readdirSync(dir).filter((f) => f.endsWith('.report.json')).sort().map((f) => ({id: f.replace('.report.json', ''), ...JSON.parse(readFileSync(join(dir, f), 'utf8'))}));
const cols = ['primary', 'secondary', 'local', 'ramp', 'service', 'other', 'water', 'waterPolys', 'parks'];
const lines = ['| city | tier | KB | ' + cols.join(' | ') + ' | budget step |', '|' + '---|'.repeat(cols.length + 4)];
const unmapped = {};
for (const r of reps) { for (const row of r.rows) lines.push(`| ${row.city} | ${row.detail} | ${row.kb} | ${cols.map((c) => row[c] ?? '-').join(' | ')} | ${row.budget.dropped.length ? 'drop ' + row.budget.dropped.join('+') + ' ' : ''}x${row.budget.scale}${row.budget.trimmedLocal ? ' trimmed' : ''} |`); Object.assign(unmapped, r.unmapped); }
const vintages = [...new Set(reps.flatMap((r) => r.sources.map((s) => s.vintage)).filter(Boolean))];
mkdirSync(join(ROOT, 'docs'), {recursive: true});
writeFileSync(join(ROOT, 'docs/kit-map-city-bake-table.md'), `# City bake table (generated)\n\nTIGER/Line vintage(s): ${vintages.join(', ')}\n\n${lines.join('\n')}\n\nMTFCC codes seen in the data but missing from the baker's table: ${Object.keys(unmapped).length ? JSON.stringify(unmapped) : 'none'}\n`);
writeFileSync(join(dir, 'credits.json'), JSON.stringify({courtesy: 'Source: U.S. Census Bureau', license: 'Public domain (U.S. Government Work)', dataset: 'TIGER/Line Shapefiles (ROADS, AREAWATER, LINEARWATER, AREALM)', vintages, cities: reps.map((r) => ({id: r.id, counties: r.counties}))}, null, 2) + '\n');
console.log(lines.join('\n'));
