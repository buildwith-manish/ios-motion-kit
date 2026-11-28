/**
 * The mapshaper step of the city baker (merge one TIGER layer across counties, clip to the city box), shared with
 * scripts/map_verify_seams.mjs so the seam check exercises exactly what the baker runs.
 */
export const DISSOLVED_LAYERS = ['areawater', 'arealm'];

export const mergeArgs = (zips, layer, lonLat, out) => [
  '-i', ...zips, 'combine-files', '-merge-layers', '-filter-fields', 'MTFCC',
  ...(DISSOLVED_LAYERS.includes(layer) ? ['-dissolve2', 'MTFCC'] : []), // union across county seams (water/parks split at county lines)
  '-clip', `bbox=${lonLat.w},${lonLat.s},${lonLat.e},${lonLat.n}`,
  '-o', out, 'format=geojson', 'precision=0.000001',
];
