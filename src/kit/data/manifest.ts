// Data provenance: every dataset a video uses is listed in data.manifest.json (validated by `npm run kit:data-check`).
// Pure helpers, no I/O. The on-screen source line is built from the manifest so it can never drift from the data.
export interface DatasetEntry {
  id: string;
  file: string;
  sourceName: string;
  url: string;
  retrievedDate: string; // YYYY-MM-DD
  dataYear: string | number;
  units: string;
  geography: string;
  notes: string;
  license: string;
  sha256: string;
}
export interface DataManifest {
  version: 1;
  staleDays?: number;
  datasets: DatasetEntry[];
}

/** 50 states + DC, USPS codes. */
export const STATES_DC = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'] as const;

/** "Source: BLS CPI, 2025, medians" (several ids: joined with "; "). Throws on an unknown id. */
export const sourceLine = (ids: string | readonly string[], manifest: DataManifest): string => {
  const list = typeof ids === 'string' ? [ids] : ids;
  const parts = [...new Set(list)].map((id) => {
    const d = manifest.datasets.find((x) => x.id === id);
    if (!d) throw new Error(`sourceLine: dataset "${id}" is not in the data manifest`);
    return [d.sourceName, d.dataYear, d.units].filter((v) => String(v).trim() !== '').join(', ');
  });
  return `Source: ${parts.join('; ')}`;
};

/** Throws unless the values add up to `total` (within `tolerance`, default 1e-6 relative to the total). */
export const assertSumsTo = (values: readonly number[], total: number, tolerance = Math.max(1e-6, Math.abs(total) * 1e-6), label = 'values'): void => {
  const sum = values.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || Math.abs(sum - total) > tolerance) throw new Error(`assertSumsTo: ${label} add up to ${sum}, expected ${total} (tolerance ${tolerance})`);
};

/** Throws unless every one of the 50 states + DC is present (keys or an array of codes); also names unknown codes. */
export const assertAllRegionsPresent = (regions: readonly string[] | Readonly<Record<string, unknown>>, label = 'data'): void => {
  const have = new Set(Array.isArray(regions) ? (regions as readonly string[]) : Object.keys(regions));
  const missing = STATES_DC.filter((s) => !have.has(s));
  const extra = [...have].filter((s) => !(STATES_DC as readonly string[]).includes(s));
  if (missing.length || extra.length) throw new Error(`assertAllRegionsPresent: ${label}${missing.length ? ` is missing ${missing.join(', ')}` : ''}${extra.length ? `${missing.length ? ' and' : ''} has unknown ${extra.join(', ')}` : ''}`);
};
