import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve('src/kit/icons/source');
const output = path.resolve('src/kit/icons/generated.tsx');
const iconFiles = readdirSync(sourceDir).filter((file) => file.endsWith('.svg')).sort();
if (iconFiles.length !== 80) throw new Error(`expected 80 Lucide source SVGs, found ${iconFiles.length}`);

const componentName = (name) => `Icon${name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}`;
const jsxAttributes = (source) => source.replace(/\b([a-z][a-z-]+)=/g, (_, name) => {
  if (name === 'class') return 'className=';
  return name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()) + '=';
});

const components = [];
for (const file of iconFiles) {
  const name = path.basename(file, '.svg');
  const svg = readFileSync(path.join(sourceDir, file), 'utf8');
  const openEnd = svg.indexOf('>');
  const closeStart = svg.lastIndexOf('</svg>');
  if (openEnd < 0 || closeStart <= openEnd) throw new Error(`invalid SVG source: ${file}`);
  const children = jsxAttributes(svg.slice(openEnd + 1, closeStart).trim());
  if (!children) throw new Error(`SVG has no shapes: ${file}`);
  components.push(`export const ${componentName(name)}: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
${children}
  </svg>
);`);
}

const names = iconFiles.map((file) => path.basename(file, '.svg'));
const registry = names.map((name) => `  '${name}': ${componentName(name)},`).join('\n');
const content = `import React from 'react';

${components.join('\n\n')}

export const ICON_COMPONENTS = {
${registry}
} as const;

export type IconName = keyof typeof ICON_COMPONENTS;
export const ICON_NAMES = Object.keys(ICON_COMPONENTS) as IconName[];
`;

writeFileSync(output, content);
console.log(`generated ${names.length} icons in ${path.relative(process.cwd(), output)}`);
