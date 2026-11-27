import React, {createContext, useContext} from 'react';
import {lerp, clamp01} from './math';
import {MotionBlur} from './MotionBlur';
import type {MatchedEntry, MotionBlurOption, Rect} from './types';

/** Registered matched elements of the outgoing and incoming scenes, keyed by id. Created fresh per render. */
export interface MatchedRegistry {
  outgoing: Map<string, MatchedEntry>;
  incoming: Map<string, MatchedEntry>;
}

/** What <TransitionScene> tells the matched elements inside a scene. */
export interface MatchedContextValue {
  role: 'outgoing' | 'incoming';
  /** True only while a matchedGeometry transition is running. */
  morphing: boolean;
  registry: MatchedRegistry;
}

export const MatchedContext = createContext<MatchedContextValue | null>(null);

/** Linear interpolation of two rects (position, size, radius). @example lerpRect(a, b, 0.5) */
export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
  radius: lerp(a.radius ?? 0, b.radius ?? 0, t),
});

const boxStyle = (r: Rect): React.CSSProperties => ({
  position: 'absolute',
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
  borderRadius: r.radius ? r.radius : undefined,
  overflow: r.radius ? 'hidden' : undefined,
});

/** Props for {@link MatchedElement}. */
export interface MatchedElementProps {
  /** Shared id: the same id must be used in the outgoing and the incoming scene. */
  id: string;
  /** Where this element sits in its scene, in canvas px (corner radius optional). */
  rect: Rect;
  children?: React.ReactNode;
}

/**
 * An element registered under `id` in both scenes of a `matchedGeometry` transition. Outside the transition it simply
 * renders at `rect`; during it, it registers its rect + content and <TransitionScene> draws one morphing copy that
 * interpolates the two rects (position, size, radius) on a spring while the rest of the scenes cross-fade. Content is
 * fitted uniformly into the morphing box, so matched elements with similar aspect ratios look best.
 * @example <MatchedElement id="card" rect={{x: 80, y: 80, width: 400, height: 240, radius: 24}}><Card /></MatchedElement>
 */
export const MatchedElement: React.FC<MatchedElementProps> = ({id, rect, children}) => {
  const ctx = useContext(MatchedContext);
  if (ctx && ctx.morphing) {
    // Idempotent write of this render's rect/content; the overlay (rendered after both scenes) reads it.
    ctx.registry[ctx.role].set(id, {rect, children});
    return null;
  }
  return <div style={boxStyle(rect)}>{children}</div>;
};

const Fit: React.FC<{entry: MatchedEntry; box: Rect; opacity: number}> = ({entry, box, opacity}) => {
  const {width: ew, height: eh} = entry.rect;
  const s = Math.min(box.width / ew, box.height / eh);
  return (
    <div
      style={{
        position: 'absolute',
        left: (box.width - ew * s) / 2,
        top: (box.height - eh * s) / 2,
        width: ew,
        height: eh,
        transform: `scale(${s})`,
        transformOrigin: '0 0',
        opacity,
      }}
    >
      {entry.children}
    </div>
  );
};

/** Props for {@link MatchedOverlay}. */
export interface MatchedOverlayProps {
  registry: MatchedRegistry;
  /** Geometry progress now and one render frame earlier (for velocity-based blur). */
  p: number;
  pPrev: number;
  motionBlur?: MotionBlurOption;
}

/**
 * Draws the morphing copies of all matched ids. Must render after both scene layers (TransitionScene guarantees it).
 * An id found in only one scene fades with its scene instead of morphing.
 * @example <MatchedOverlay registry={registry} p={0.5} pPrev={0.48} />
 */
export const MatchedOverlay: React.FC<MatchedOverlayProps> = ({registry, p, pPrev, motionBlur}) => {
  const ids = Array.from(new Set([...registry.outgoing.keys(), ...registry.incoming.keys()]));
  const sh = typeof motionBlur === 'object' ? motionBlur.shutter ?? 0.5 : 0.5;
  const cap = typeof motionBlur === 'object' ? Math.min(20, motionBlur.cap ?? 20) : 20;
  return (
    <>
      {ids.map((id) => {
        const a = registry.outgoing.get(id);
        const b = registry.incoming.get(id);
        if (a && b) {
          const box = lerpRect(a.rect, b.rect, p);
          const prev = lerpRect(a.rect, b.rect, pPrev);
          const bIn = clamp01((p - 0.15) / 0.5);
          const aOut = 1 - clamp01((p - 0.7) / 0.3);
          return (
            <MotionBlur key={id} dx={motionBlur ? box.x - prev.x : 0} dy={motionBlur ? box.y - prev.y : 0} shutter={sh} cap={cap} style={{position: 'absolute', inset: 0, zIndex: 50}}>
              <div style={boxStyle(box)}>
                <Fit entry={a} box={box} opacity={aOut} />
                <Fit entry={b} box={box} opacity={bIn} />
              </div>
            </MotionBlur>
          );
        }
        const only = (a ?? b) as MatchedEntry;
        const o = a ? 1 - p : p;
        return (
          <div key={id} style={{...boxStyle(only.rect), opacity: o, zIndex: 50}}>
            {only.children}
          </div>
        );
      })}
    </>
  );
};
