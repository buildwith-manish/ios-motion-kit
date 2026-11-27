import React from 'react';
import type {GeoProjection} from 'd3-geo';
import {DepthLayer, DepthLayers, Tilt3D, type CameraState} from '../camera';
import {useTheme} from '../tokens';
import {MapCanvas} from './MapCanvas';
import {FocusDim} from './FocusDim';
import {RegionHighlight} from './RegionHighlight';
import {dimAmountAt, highlightStateAt, type HighlightStep} from './highlight';
import {useRegionShapes} from './useRegionShapes';
import {mapStyle, mapStyleFromTheme} from './styles';
import type {MapStyle, MapStyleName, RegionKind} from './types';

export interface HighlightStageProps {
  projection: GeoProjection;
  frame: number;
  /** Which regions light up, and when (seconds). */
  steps: HighlightStep[];
  /** Layer the step ids belong to. */
  kind: RegionKind;
  /** Tracts only: state FIPS. */
  state?: string;
  style?: MapStyleName | MapStyle;
  /** Base map layers (e.g. <RegionLayer kind="state" />). */
  children?: React.ReactNode;
  /** Dim everything else (default true). */
  focusDim?: boolean;
  /** Rise of a highlighted region, px (default 10). */
  lift?: number;
  /** Tilt of the whole map in degrees, 5..8 (default 6); 0 turns the 3D mount off. */
  tilt?: number;
  /** CSS perspective distance, px (default 1600). */
  perspective?: number;
  /** Camera pose from <CameraRig> for parallax between the base map and the lifted regions. */
  camera?: CameraState;
  /** Drawing margin around the canvas, so land does not end at the frame edge under the tilt (default 0.12). */
  overscan?: number;
}

type Common = Pick<HighlightStageProps, 'frame' | 'steps' | 'kind' | 'state'>;

const useFocusShapes = ({frame, steps, kind, state}: Common, fps: number) => {
  const ids = Array.from(new Set(steps.flatMap((s) => s.ids)));
  // the whole layer (not just the ids), so the geometry is simplified exactly like the base map under it
  const shapes = useRegionShapes(kind, {}, state)?.filter((s) => ids.includes(s.id));
  const progress = highlightStateAt(frame / fps, steps);
  return (shapes ?? []).flatMap((shape) => {
    const p = progress.get(shape.id) ?? 0;
    return p > 0 ? [{shape, p}] : [];
  });
};

const DimLayer: React.FC<Common> = (props) => {
  const fps = useTheme().canvas.fps;
  const on = useFocusShapes(props, fps);
  return <FocusDim amount={dimAmountAt(props.frame / fps, props.steps)} focus={on.map((o) => ({d: o.shape.d, progress: o.p}))} />;
};

const LiftedRegions: React.FC<Common & {lift: number}> = ({lift, ...props}) => {
  const on = useFocusShapes(props, useTheme().canvas.fps);
  // later steps draw on top
  return <>{on.map((o) => <RegionHighlight key={o.shape.id} shape={o.shape} progress={o.p} lift={lift} />)}</>;
};

/**
 * A highlight-and-focus map: base layers + focus dim on the ground plane, highlighted regions on a plane above it
 * (DepthLayers parallax), the whole thing on a subtle Tilt3D mount. Pure function of `frame`.
 */
export const HighlightStage: React.FC<HighlightStageProps> = ({projection, frame, steps, kind, state, style, children, focusDim = true, lift = 10, tilt = 6, perspective = 1600, camera, overscan = 0.12}) => {
  const theme = useTheme();
  const {width, height} = theme.canvas;
  const s = typeof style === 'string' ? mapStyle(style) : style ?? mapStyleFromTheme(theme);
  const common = {frame, steps, kind, state};
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: s.water}}>
      <Tilt3D rotateX={tilt} maxTilt={8} perspective={perspective} width={width} height={height} frame={frame} sway={tilt ? {amplitudeX: 0.5, amplitudeY: 1, periodSeconds: 12} : undefined}>
        <DepthLayers camera={camera} frame={frame} idle={{amplitude: 8, scale: 0.004, periodSeconds: 10}}>
          <DepthLayer depth={0.5}>
            <MapCanvas projection={projection} style={s} overscan={overscan}>
              {children}
              {focusDim ? <DimLayer {...common} /> : null}
            </MapCanvas>
          </DepthLayer>
          <DepthLayer depth={0.85}>
            <MapCanvas projection={projection} style={s} overscan={overscan} background={false}>
              <LiftedRegions {...common} lift={lift} />
            </MapCanvas>
          </DepthLayer>
        </DepthLayers>
      </Tilt3D>
    </div>
  );
};
