import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import type {CityAlignment} from './CityLayer';

let cache: Promise<Record<string, CityAlignment>> | null = null;
const loadAll = () => {
  if (!cache) cache = fetch(staticFile('kit/map/cities/alignment.json')).then((r) => { if (!r.ok) throw new Error('cities/alignment.json missing (run the "Bake map cities" workflow)'); return r.json(); });
  return cache;
};

/** One city's entry of baked cities/alignment.json (null while it loads). Pass the result to <MetroMap alignment>. */
export const useCityAlignment = (id: string): CityAlignment | null => {
  const [a, setA] = useState<CityAlignment | null>(null);
  useEffect(() => {
    const h = delayRender(`alignment ${id}`); let live = true;
    loadAll().then((all) => { if (live) setA(all[id] ?? null); continueRender(h); }, (e) => { console.error(e); continueRender(h); });
    return () => { live = false; };
  }, [id]);
  return a;
};
