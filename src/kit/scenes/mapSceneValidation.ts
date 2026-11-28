/** Pure validation of the map scene types. Called from layoutSceneSequence, so a bad scene fails before any frame renders. */
import type {SceneDefinition} from './types';
import {
  CITY_BOX_HALF_KM, canonicalRegionData, canonicalRegionId, flyTiming, isBakedCity, kmFrom, normalizeStateId, planHighlights,
  BAKED_CITIES,
} from './regionData';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const checkLatLng = (id: string, what: string, p: {lat: number; lng: number}): void => {
  if (!finite(p?.lat) || !finite(p?.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) throw new RangeError(`Scene "${id}": ${what} needs a finite lat (-90..90) and lng (-180..180)`);
};

const checkInBox = (id: string, city: keyof typeof BAKED_CITIES, what: string, p: {lat: number; lng: number}): void => {
  checkLatLng(id, what, p);
  const {east, north} = kmFrom(BAKED_CITIES[city], p);
  if (Math.abs(east) > CITY_BOX_HALF_KM || Math.abs(north) > CITY_BOX_HALF_KM) {
    throw new RangeError(`Scene "${id}": ${what} is ${Math.abs(east).toFixed(1)} km east/west and ${Math.abs(north).toFixed(1)} km north/south of ${BAKED_CITIES[city].name}; the baked street box reaches ${CITY_BOX_HALF_KM} km. Move it closer or use countryPins / countryCallouts.`);
  }
};

export const validateMapScene = (scene: SceneDefinition): void => {
  switch (scene.type) {
    case 'choropleth': {
      const level = scene.level ?? 'states';
      canonicalRegionData(scene.id, level, scene.data);
      if (level === 'zcta' && !(scene.scope && /^\d{5}$/.test(scene.scope.trim()))) {
        throw new RangeError(`Scene "${scene.id}": level "zcta" needs scope = the five-digit CBSA code of a baked zcta-metro file (for example "16980").`);
      }
      if (level === 'counties' && scene.scope !== undefined && normalizeStateId(scene.scope) === null) {
        throw new RangeError(`Scene "${scene.id}": scope "${scene.scope}" is not a state (use a FIPS, USPS code or name), or omit it for all counties.`);
      }
      if ((level === 'states' || level === 'cbsa') && scene.scope !== undefined) {
        throw new RangeError(`Scene "${scene.id}": scope is only supported for levels "counties" and "zcta".`);
      }
      const need = scene.scale === 'diverging' ? 3 : 2;
      if (scene.domain !== undefined) {
        const d = scene.domain;
        if (d.length !== need || !d.every(finite) || d.some((v, i) => i > 0 && v <= d[i - 1])) {
          throw new RangeError(`Scene "${scene.id}": domain must be ${need} increasing numbers for a ${scene.scale ?? 'sequential'} scale`);
        }
      }
      for (const c of scene.callouts ?? []) {
        if (canonicalRegionId(level, c.region) === null) throw new RangeError(`Scene "${scene.id}": callout region "${c.region}" is not a valid ${level} id`);
      }
      const r = scene.reveal;
      if (r && ((r.start !== undefined && !(finite(r.start) && r.start >= 0 && r.start < scene.duration)) || (r.spread !== undefined && !(finite(r.spread) && r.spread >= 0)))) {
        throw new RangeError(`Scene "${scene.id}": reveal.start must be inside the scene and reveal.spread must be zero or more (seconds)`);
      }
      if (scene.camera?.to !== undefined && !(finite(scene.camera.to) && scene.camera.to >= 1 && scene.camera.to <= 1.3)) {
        throw new RangeError(`Scene "${scene.id}": camera.to must be between 1 and 1.3`);
      }
      return;
    }
    case 'regionHighlight': {
      const level = scene.level ?? 'states';
      if (level === 'states' && scene.scope !== undefined) throw new RangeError(`Scene "${scene.id}": scope is only supported for level "counties".`);
      if (level === 'counties' && scene.scope !== undefined && normalizeStateId(scene.scope) === null) {
        throw new RangeError(`Scene "${scene.id}": scope "${scene.scope}" is not a state (use a FIPS, USPS code or name).`);
      }
      const seen = new Set<string>();
      const regions = scene.regions.map((r) => {
        const id = canonicalRegionId(level, r.id);
        if (id === null) throw new RangeError(`Scene "${scene.id}": region "${r.id}" is not a valid ${level} id`);
        if (seen.has(id)) throw new RangeError(`Scene "${scene.id}": region "${r.id}" is listed twice`);
        seen.add(id);
        if (r.value !== undefined && !finite(r.value)) throw new RangeError(`Scene "${scene.id}": value of region "${r.id}" must be a finite number`);
        return {...r, id};
      });
      planHighlights(scene.id, scene.duration, regions);
      return;
    }
    case 'flyToCity': {
      if (!isBakedCity(scene.city)) {
        throw new RangeError(`Scene "${scene.id}": city "${String(scene.city)}" is not baked. Choose one of: ${Object.keys(BAKED_CITIES).join(', ')}.`);
      }
      const withCountry = Boolean(scene.arc || scene.countryPins?.length || scene.countryCallouts?.length);
      flyTiming(scene.id, scene.duration, withCountry);
      if (scene.arc) { checkLatLng(scene.id, 'arc.from', scene.arc.from); checkLatLng(scene.id, 'arc.to', scene.arc.to); }
      (scene.countryPins ?? []).forEach((p, i) => checkLatLng(scene.id, `countryPins[${i}]`, p));
      (scene.countryCallouts ?? []).forEach((c, i) => checkLatLng(scene.id, `countryCallouts[${i}]`, c));
      (scene.pins ?? []).forEach((p, i) => checkInBox(scene.id, scene.city, `pins[${i}]`, p));
      (scene.route ?? []).forEach((p, i) => checkInBox(scene.id, scene.city, `route[${i}]`, p));
      (scene.callouts ?? []).forEach((c, i) => {
        checkInBox(scene.id, scene.city, `callouts[${i}]`, c);
        if (c.value !== undefined && !finite(c.value)) throw new RangeError(`Scene "${scene.id}": callouts[${i}].value must be a finite number`);
      });
      if (scene.route && scene.route.length < 2) throw new RangeError(`Scene "${scene.id}": route needs at least two points`);
      return;
    }
    default:
      return;
  }
};
