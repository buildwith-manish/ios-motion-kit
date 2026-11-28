import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Icon, ICON_NAMES} from '../src/kit/icons';

let failures = 0;
for (const name of ICON_NAMES) {
  const markup = renderToStaticMarkup(React.createElement(Icon, {name}));
  const shapes = (markup.match(/<(?:path|circle|rect|line|polyline|polygon|ellipse)\b/g) ?? []).length;
  const passed = markup.startsWith('<svg') && shapes > 0;
  if (!passed) failures++;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${shapes} shape(s)`);
}

if (ICON_NAMES.length !== 80) {
  failures++;
  console.error(`FAIL expected 80 icons, found ${ICON_NAMES.length}`);
}

console.log(failures ? `\n${failures} icon audit failure(s)` : `\nall ${ICON_NAMES.length} icons render non-empty`);
process.exit(failures ? 1 : 0);
