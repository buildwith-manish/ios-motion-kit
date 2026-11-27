import {useBakedTopo} from './RegionLayer';
import {useMap} from './MapCanvas';
import {selectShapes, type MapShape, type RegionSelection} from './regions';
import type {RegionKind} from './types';

/** File of a region kind, relative to public/kit/map/regions/. Tracts need the two-digit state FIPS. */
export const regionFile = (kind: RegionKind, state?: string): string => {
  if (kind === 'tract') {
    if (!state) throw new Error('kind="tract" needs state (FIPS)');
    return `tracts/${state}.json`;
  }
  return `${({state: 'states', county: 'counties', cbsa: 'cbsa', zcta: 'zcta'} as const)[kind]}.json`;
};

/** Projected shapes of a baked layer inside the current <MapCanvas>. null while the file loads. */
export const useRegionShapes = (kind: RegionKind, selection: RegionSelection = {}, state?: string, file?: string): MapShape[] | null => {
  const {projection, view} = useMap();
  const topo = useBakedTopo(file ?? regionFile(kind, state));
  return topo ? selectShapes(topo, projection, view, selection) : null;
};
