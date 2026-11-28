import React, {useEffect, useMemo, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {geoAlbers, geoAlbersUsa} from 'd3-geo';
import {sampleCamera} from '../camera';
import {iosSpring} from '../motion';
import {safeRect, textStyle, unit, useTheme} from '../tokens';
import type {Theme} from '../tokens';
import {rgba} from '../tokens/color';
import {formatNumber} from '../text/format';
import type {FormatPresetName, FormatSpec} from '../text/format';
import {
  allFeatures, Arc, Choropleth, featureById, fitExtent, flightPlan, FlyMap, HighlightStage, highlightProgress, makeColorScale,
  MapCallouts, MapCanvas, MapLegend, TileGridMap, MapPin, MapSourceLine, RegionLayer, RouteDraw, topoFeatures, useBakedTopo, useCity,
  useCityAlignment, useRegionShapes, regionFile, useUsProjection,
  type RegionKind,
} from '../map';
import {
  BAKED_CITIES, US_STATES, canonicalRegionData, canonicalRegionId, flyTiming, highlightSteps, normalizeStateId, planHighlights,
  type MapLevel, type RegionRecord,
} from './regionData';
import type {ChoroplethSceneData, FlyToCitySceneData, RegionHighlightSceneData, TileGridSceneData} from './types';
import type {SceneTemplateProps} from './templates';

const KIND: Record<MapLevel, RegionKind> = {states: 'state', counties: 'county', cbsa: 'cbsa', zcta: 'zcta'};

/**
 * Fails the render with an actionable message when a baked file is missing (the kit's loaders only log and return null,
 * which would leave blank frames). `rel` is relative to public/.
 */
export const useRequireBaked = (rel: string): void => {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const handle = delayRender(`require ${rel}`);
    let live = true;
    fetch(staticFile(rel)).then(
      (r) => { if (live && !r.ok) setError(`HTTP ${r.status}`); continueRender(handle); },
      (e) => { if (live) setError(String(e?.message ?? e)); continueRender(handle); },
    );
    return () => { live = false; };
  }, [rel]);
  if (error) throw new Error(`Map scene needs baked data "public/${rel}" (${error}). Run \`npm run kit:fetch-data\` (see docs/repo-rules.md), or the "Bake map regions" / "Bake map cities" workflow.`);
};

const useLayout = (theme: Theme, hasSubtitle: boolean) => {
  const {width, height} = theme.canvas;
  const u = unit(theme);
  const safe = safeRect(theme, 'title');
  const portrait = height > width;
  const top = safe.top + (hasSubtitle ? 190 : 150) * u;
  const right = safe.left + safe.width;
  const bottom = safe.top + safe.height;
  return {width, height, u, safe, portrait, top, right, bottom, rightInset: width - right, bottomInset: height - bottom};
};

const Heading: React.FC<{theme: Theme; title: string; subtitle?: string; left: number; top: number; opacity?: number}> = ({theme, title, subtitle, left, top, opacity = 1}) => {
  const u = unit(theme);
  return (
    <div style={{position: 'absolute', left, top, opacity}}>
      <div style={{...textStyle(theme, 'title', {scale: 0.85}), color: theme.colors.text.primary}}>{title}</div>
      {subtitle ? <div style={{...textStyle(theme, 'caption', {color: 'secondary'}), marginTop: 10 * u}}>{subtitle}</div> : null}
    </div>
  );
};

const stateScope = (scope: string | undefined): string | undefined => (scope === undefined ? undefined : normalizeStateId(scope) ?? undefined);

/** Callouts anchored to region centroids, drawn inside <MapCanvas>. */
const RegionCallouts: React.FC<{
  frame: number; at: number; kind: RegionKind; file?: string; items: {id: string; label?: string}[]; data: RegionRecord;
  format: FormatPresetName | FormatSpec;
}> = ({frame, at, kind, file, items, data, format}) => {
  const theme = useTheme();
  const u = unit(theme);
  const {width, height} = theme.canvas;
  const shapes = useRegionShapes(kind, {ids: items.map((i) => i.id)}, undefined, file);
  if (!shapes) return null;
  const font = textStyle(theme, 'caption');
  const fs = 26 * u;
  return (
    <g>
      {items.map((item, index) => {
        const shape = shapes.find((s) => s.id === item.id);
        if (!shape) return null;
        const p = Math.max(0, Math.min(1, iosSpring(frame / theme.canvas.fps - (at + index * 0.35), theme.motion.spring.SMOOTH)));
        if (p <= 0.001) return null;
        const label = item.label ?? shape.name ?? item.id;
        const v = data[item.id];
        const value = typeof v === 'number' ? formatNumber(v, format) : 'No data';
        const w = Math.max(label.length, value.length) * fs * 0.58 + 36 * u;
        const h = fs * 2.5 + 16 * u;
        const margin = 24 * u;
        const cx = Math.max(w / 2 + margin, Math.min(width - w / 2 - margin, shape.centroid[0]));
        const cy = Math.max(h + 28 * u + margin, Math.min(height - margin, shape.centroid[1]));
        return (
          <g key={item.id} opacity={p} transform={`translate(${shape.centroid[0]} ${shape.centroid[1]}) scale(${0.94 + 0.06 * p}) translate(${-shape.centroid[0]} ${-shape.centroid[1]})`}>
            <line x1={shape.centroid[0]} y1={shape.centroid[1]} x2={cx} y2={cy - 6 * u} stroke={rgba(theme.colors.text.primary, 0.7)} strokeWidth={2 * u} />
            <circle cx={shape.centroid[0]} cy={shape.centroid[1]} r={7 * u} fill={theme.colors.accent} stroke={theme.colors.background.deep} strokeWidth={2 * u} />
            <rect x={cx - w / 2} y={cy - h - 6 * u} width={w} height={h} rx={18 * u} fill={rgba(theme.colors.background.deep, 0.88)} stroke={rgba(theme.colors.text.primary, 0.22)} strokeWidth={1.5 * u} />
            <text x={cx} y={cy - h + fs * 0.95} textAnchor="middle" style={{...font, fontSize: fs * 0.82}} fill={theme.colors.text.secondary}>{label}</text>
            <text x={cx} y={cy - h + fs * 2.05} textAnchor="middle" style={{...font, fontSize: fs * 1.1, fontWeight: 700}} fill={theme.colors.text.primary}>{value}</text>
          </g>
        );
      })}
    </g>
  );
};

export interface ChoroplethSceneProps extends SceneTemplateProps {scene: ChoroplethSceneData}

/** choropleth: states (or counties / CBSAs / ZIP areas of one metro) coloured from plain JSON, with legend, callouts and a slow push-in. */
export const ChoroplethScene: React.FC<ChoroplethSceneProps> = ({frame, start, theme, scene}) => {
  const level = scene.level ?? 'states';
  const kind = KIND[level];
  const {u, safe, portrait, top, right, bottom, rightInset, bottomInset} = useLayout(theme, Boolean(scene.subtitle));
  const data = useMemo(() => canonicalRegionData(scene.id, level, scene.data), [scene.id, level, scene.data]);
  const dataFile = level === 'zcta' ? `zcta-metro/${scene.scope}.json` : regionFile(kind);
  useRequireBaked('kit/map/regions/states.json');
  useRequireBaked(`kit/map/regions/${level === 'zcta' ? 'cbsa.json' : dataFile}`);
  useRequireBaked(`kit/map/regions/${dataFile}`);
  const states = useBakedTopo('states.json');
  const cbsa = useBakedTopo(level === 'zcta' ? 'cbsa.json' : 'states.json');
  const layer = useBakedTopo(dataFile);
  const state = stateScope(scene.scope);
  const format = scene.format ?? 'int';

  const known = useMemo(() => (layer ? topoFeatures(layer) : null), [layer]);
  // which regions are drawn, so that regions without a value show hatched: all states, all counties (or the scope's), the data's own CBSAs
  const selection = useMemo((): {ids?: string[]; idPrefix?: string} => {
    if (level === 'states') return {ids: US_STATES.map((s) => s.fips)};
    if (level === 'counties') return state ? {idPrefix: state} : {ids: known ? [...known.keys()] : []};
    return {ids: Object.keys(data)};
  }, [level, state, known, data]);
  if (known) {
    const unknown = Object.keys(data).filter((id) => !known.has(id));
    if (unknown.length) {
      throw new RangeError(`Scene "${scene.id}": ${unknown.length} region id(s) are not in the baked ${level} layer (${dataFile}): ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? ', ...' : ''}. Check the ids against the Census vintage of the baked data.`);
    }
  }

  const box = portrait
    ? {x0: safe.left, y0: top, x1: right, y1: top + safe.width * 0.72}
    : {x0: safe.left, y0: top, x1: right - 600 * u, y1: bottom - 40 * u};
  const metro = level === 'zcta' && cbsa ? featureById(cbsa, String(scene.scope)) : null;
  const stateFeature = level === 'counties' && state && states ? featureById(states, state) : null;
  const projection = useMemo(() => {
    if (!states || !cbsa) return null;
    if (level === 'zcta') return metro ? fitExtent(geoAlbers(), metro, box) : null;
    if (stateFeature) return fitExtent(geoAlbers(), stateFeature, box);
    return fitExtent(geoAlbersUsa(), allFeatures(states), box);
  }, [states, cbsa, level, metro, stateFeature, box.x0, box.y0, box.x1, box.y1]);
  if (level === 'zcta' && cbsa && !metro) throw new RangeError(`Scene "${scene.id}": CBSA "${scene.scope}" is not in the baked cbsa layer`);
  if (level === 'counties' && state && states && !stateFeature) throw new RangeError(`Scene "${scene.id}": state "${scene.scope}" is not in the baked states layer`);
  if (!projection || !layer) return null;

  const scale = makeColorScale(theme, {type: scene.scale ?? 'sequential', domain: scene.domain}, data);
  const time = frame / theme.canvas.fps - start;
  const reveal = {start: scene.reveal?.start ?? 0.6, spread: scene.reveal?.spread ?? 1.4, order: scene.reveal?.order ?? 'value'};
  const calloutAt = start + reveal.start + reveal.spread + 0.6;
  const items = (scene.callouts ?? []).map((c) => ({id: canonicalRegionId(level, c.region) as string, label: c.label}));
  const push = scene.camera?.to ?? 1.04;
  const progress = Math.min(1, Math.max(0, time / scene.duration));
  const zoom = 1 + (push - 1) * (progress * progress * (3 - 2 * progress));
  const legendStyle: React.CSSProperties = portrait
    ? {position: 'absolute', left: safe.left, top: box.y1 + 36 * u}
    : {position: 'absolute', right: rightInset, bottom: bottomInset};
  const legendFormat = (v: number) => formatNumber(v, format);
  const common = {frame, start: start + reveal.start, spread: reveal.spread, order: reveal.order} as const;

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '50% 55%'}}>
        <MapCanvas projection={projection}>
          <RegionLayer kind={level === 'zcta' ? 'cbsa' : kind === 'county' && !state ? 'state' : kind} {...(kind === 'county' && state ? {idPrefix: state} : {})} />
          {level === 'zcta' ? (
            <Choropleth kind="zcta" file={dataFile} within={metro} data={data} scale={scale} {...common} />
          ) : (
            <Choropleth kind={kind} data={data} scale={scale} {...common} {...selection} />
          )}
          {items.length ? <RegionCallouts frame={frame} at={calloutAt} kind={kind} file={level === 'zcta' ? dataFile : undefined} items={items} data={data} format={format} /> : null}
        </MapCanvas>
      </div>
      <Heading theme={theme} title={scene.title} subtitle={scene.subtitle} left={safe.left} top={safe.top} />
      <MapLegend scale={scale} title={scene.legendTitle} format={legendFormat} style={legendStyle} />
      {scene.source ? <MapSourceLine text={scene.source} style={{position: 'absolute', left: safe.left, bottom: bottomInset - 8 * u}} /> : null}
    </div>
  );
};

export interface RegionHighlightSceneProps extends SceneTemplateProps {scene: RegionHighlightSceneData}

/** regionHighlight: regions lit one at a time with focus dimming (HighlightStage), each with its name and value. */
export const RegionHighlightScene: React.FC<RegionHighlightSceneProps> = ({frame, start, theme, scene}) => {
  const level = scene.level ?? 'states';
  const kind = KIND[level];
  const {u, safe, portrait, top, right, bottom, bottomInset} = useLayout(theme, Boolean(scene.subtitle));
  const dataFile = regionFile(kind);
  useRequireBaked('kit/map/regions/states.json');
  useRequireBaked(`kit/map/regions/${dataFile}`);
  const states = useBakedTopo('states.json');
  const layer = useBakedTopo(dataFile);
  const state = stateScope(scene.scope);
  const plan = useMemo(
    () => planHighlights(scene.id, scene.duration, scene.regions.map((r) => ({...r, id: canonicalRegionId(level, r.id) as string}))),
    [scene.id, scene.duration, scene.regions, level],
  );
  const steps = useMemo(() => highlightSteps(start, plan), [start, plan]);
  const known = useMemo(() => (layer ? topoFeatures(layer) : null), [layer]);
  if (known) {
    const unknown = plan.filter((p) => !known.has(p.id)).map((p) => p.id);
    if (unknown.length) throw new RangeError(`Scene "${scene.id}": region id(s) not in the baked ${level} layer (${dataFile}): ${unknown.join(', ')}`);
  }
  const box = {x0: safe.left, y0: portrait ? top + 90 * u : top, x1: right, y1: portrait ? Math.min(bottom - 120 * u, top + safe.width * 0.9) : bottom - 20 * u};
  const stateFeature = level === 'counties' && state && states ? featureById(states, state) : null;
  const projection = useMemo(() => {
    if (!states) return null;
    if (stateFeature) return fitExtent(geoAlbers(), stateFeature, box);
    return fitExtent(geoAlbersUsa(), allFeatures(states), box);
  }, [states, stateFeature, box.x0, box.y0, box.x1, box.y1]);
  if (level === 'counties' && state && states && !stateFeature) throw new RangeError(`Scene "${scene.id}": state "${scene.scope}" is not in the baked states layer`);
  if (!projection || !layer || !known) return null;

  const time = frame / theme.canvas.fps;
  const format = scene.format ?? 'int';
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <HighlightStage projection={projection} frame={frame} steps={steps} kind={kind} tilt={scene.tilt}>
        <RegionLayer kind={kind} {...(kind === 'county' && state ? {idPrefix: state} : {})} />
      </HighlightStage>
      <Heading theme={theme} title={scene.title} subtitle={scene.subtitle} left={safe.left} top={safe.top} />
      {plan.map((p, i) => {
        const input = scene.regions[i];
        const step = steps[i];
        const o = Math.max(0, 2 * highlightProgress(time, step.at, step.until) - 1);
        if (o <= 0) return null;
        const name = input.label ?? known.get(p.id)?.properties?.NAME ?? p.id;
        return (
          <div key={p.id} style={{position: 'absolute', left: safe.left, top: portrait ? top : top + 20 * u, opacity: o}}>
            <div style={{...textStyle(theme, 'title', {scale: 1.1}), color: theme.colors.accent}}>{name}</div>
            {input.value !== undefined ? <div style={{...textStyle(theme, 'title', {scale: 0.8}), color: theme.colors.text.primary}}>{formatNumber(input.value, format)}</div> : null}
          </div>
        );
      })}
      {scene.source ? <MapSourceLine text={scene.source} style={{position: 'absolute', left: safe.left, bottom: bottomInset - 8 * u}} /> : null}
    </div>
  );
};

export interface FlyToCitySceneProps extends SceneTemplateProps {scene: FlyToCitySceneData}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const US_CENTRE = {lat: 39.5, lng: -98, zoom: 0.45};

/** flyToCity: across the US to one of the ten baked cities, with pins, an optional arc / route and numeric callouts. */
export const FlyToCityScene: React.FC<FlyToCitySceneProps> = ({frame, start, theme, scene}) => {
  const city = BAKED_CITIES[scene.city];
  const withCountry = Boolean(scene.arc || scene.countryPins?.length || scene.countryCallouts?.length);
  const timing = flyTiming(scene.id, scene.duration, withCountry);
  const {u, safe, bottomInset} = useLayout(theme, Boolean(scene.subtitle));
  useRequireBaked('kit/map/regions/outline.json');
  useRequireBaked(`kit/map/cities/${scene.city}.json`);
  useRequireBaked('kit/map/cities/alignment.json');
  const projection = useUsProjection();
  const cityData = useCity(scene.city, 'rich');
  const alignment = useCityAlignment(scene.city);
  const plan = useMemo(() => {
    if (!projection) return null;
    const legs = [
      ...(timing.country ? [{lat: US_CENTRE.lat, lng: US_CENTRE.lng, zoom: US_CENTRE.zoom, duration: timing.country.duration, hold: timing.country.hold}] : []),
      {lat: city.lat, lng: city.lng, zoom: 8.3, duration: timing.metro.duration, hold: timing.metro.hold},
    ];
    return flightPlan({projection, canvas: theme.canvas, from: timing.country ? {lat: 47.6, lng: -122.3, zoom: 3} : US_CENTRE, start: start + timing.leadIn, legs});
  }, [projection, theme.canvas, timing, city.lat, city.lng, start]);
  if (!projection || !plan || !cityData || !alignment) return null;

  const t = frame / theme.canvas.fps;
  const metroLeg = plan.legs[plan.legs.length - 1];
  const countryLeg = timing.country ? plan.legs[0] : null;
  const metroPose = sampleCamera(plan.keyframes, metroLeg.lands);
  const countryPose = countryLeg ? sampleCamera(plan.keyframes, countryLeg.lands) : null;
  const countryOpacity = countryLeg ? 1 - smooth(metroLeg.departs, metroLeg.departs + 1.2, t) : 0;
  const stagger = (i: number, base: number) => base + i * 0.3;

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <FlyMap frame={frame} keyframes={plan.keyframes} projection={projection} metro={{city: cityData, alignment}} blend={[6.2, 7.6]} outlineId={city.cbsa}>
        {countryLeg && countryPose && countryOpacity > 0.002 ? (
          <div style={{position: 'absolute', inset: 0, opacity: countryOpacity}}>
            {(scene.countryPins ?? []).map((p, i) => <MapPin key={`cp${i}`} lat={p.lat} lng={p.lng} label={p.label} at={countryLeg.lands - 0.2 + i * 0.4} />)}
            {scene.arc ? <Arc from={scene.arc.from} to={scene.arc.to} at={countryLeg.lands + 0.7} response={1.4} /> : null}
            {scene.countryCallouts?.length ? (
              <MapCallouts
                layoutPose={countryPose}
                items={scene.countryCallouts.map((c, i) => ({id: `cc${i}`, lat: c.lat, lng: c.lng, title: c.title, value: c.value, decimals: c.decimals, prefix: c.prefix, suffix: c.suffix, at: countryLeg.lands + (c.at ?? stagger(i, 1.2))}))}
              />
            ) : null}
          </div>
        ) : null}
        {(scene.pins ?? []).map((p, i) => <MapPin key={`p${i}`} lat={p.lat} lng={p.lng} label={p.label} at={metroLeg.lands - 0.1 + i * 0.3} scale={i === 0 ? 1.1 : 1} />)}
        {scene.route && scene.route.length > 1 ? <RouteDraw points={[...scene.route]} at={metroLeg.lands + 0.9} response={1.4} /> : null}
        {scene.callouts?.length ? (
          <MapCallouts
            layoutPose={metroPose}
            items={scene.callouts.map((c, i) => ({id: `c${i}`, lat: c.lat, lng: c.lng, title: c.title, value: c.value, decimals: c.decimals, prefix: c.prefix, suffix: c.suffix, at: metroLeg.lands + (c.at ?? stagger(i, 1.5))}))}
          />
        ) : null}
      </FlyMap>
      <Heading theme={theme} title={scene.title} subtitle={scene.subtitle} left={safe.left} top={safe.top} />
      {scene.source ? <MapSourceLine text={scene.source} style={{position: 'absolute', left: safe.left, bottom: bottomInset - 8 * u}} /> : null}
    </div>
  );
};

export interface TileGridSceneProps extends SceneTemplateProps {scene: TileGridSceneData}

/** tileGrid: one square per US state (DC included) coloured from plain JSON, with legend and source line. Needs no baked data. */
export const TileGridScene: React.FC<TileGridSceneProps> = ({frame, start, theme, scene}) => {
  const {u, safe, portrait, top, right, bottom, rightInset, bottomInset} = useLayout(theme, Boolean(scene.subtitle));
  const format = scene.format ?? 'int';
  const byFips = useMemo(() => canonicalRegionData(scene.id, 'states', scene.data), [scene.id, scene.data]);
  const data = useMemo(() => Object.fromEntries(US_STATES.filter((s) => byFips[s.fips] !== undefined).map((s) => [s.usps, byFips[s.fips]])), [byFips]);
  const scale = makeColorScale(theme, {type: scene.scale ?? 'sequential', domain: scene.domain}, data);
  const box = portrait
    ? {x0: safe.left, y0: top, x1: right, y1: top + safe.width * 0.8}
    : {x0: safe.left, y0: top, x1: right - 520 * u, y1: bottom - 40 * u};
  const legendStyle: React.CSSProperties = portrait
    ? {position: 'absolute', left: safe.left, top: box.y1 + 36 * u}
    : {position: 'absolute', right: rightInset, bottom: bottomInset};
  const fmt = (v: number) => formatNumber(v, format);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <TileGridMap theme={theme} frame={frame - start * theme.canvas.fps} start={scene.reveal?.start ?? 0.6} spread={scene.reveal?.spread ?? 1.4} order={scene.reveal?.order ?? 'value'} data={data} scale={scale} box={box} showValues={scene.values ?? true} format={fmt} />
      <Heading theme={theme} title={scene.title} subtitle={scene.subtitle} left={safe.left} top={safe.top} />
      <MapLegend scale={scale} title={scene.legendTitle} format={fmt} style={legendStyle} />
      {scene.source ? <MapSourceLine text={scene.source} style={{position: 'absolute', left: safe.left, bottom: bottomInset - 8 * u}} /> : null}
    </div>
  );
};
