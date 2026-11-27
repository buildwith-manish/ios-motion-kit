import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CameraRig, DepthLayer, DepthLayers, RackFocus, RackLayer, Tilt3D, type CameraKeyframe, type FocusKeyframe} from '../camera';
import {Glass} from '../glass';
import {CANVAS, createTheme, type Canvas, type Theme} from '../tokens';

/** Demo length in seconds. */
export const CAMERA_DEMO_SECONDS = 10;
/** When the rack focus moves from card A to card B, seconds. */
export const RACK_AT = 6.6;

/** Demo layout in px for a theme: card centres sit `d` px either side of the middle along the long axis. */
const layout = (theme: Theme) => {
  const {width: w, height: h} = theme.canvas;
  const vertical = h > w;
  const d = vertical ? h * 0.19 : w * 0.17;
  const card = vertical ? {w: w * 0.72, h: h * 0.17} : {w: w * 0.26, h: h * 0.42};
  return {w, h, vertical, d, card};
};

/**
 * Camera keyframes for the demo: pan (0.6-3.0 s), push-in (3.4-6.0 s), then a slow roll while drifting toward card B
 * (7.4-9.2 s). Rack focus A to B is separate ({@link RACK_AT}).
 * @example const kf = cameraDemoKeyframes(createTheme());
 */
export const cameraDemoKeyframes = (theme: Theme): CameraKeyframe[] => {
  const {vertical, d} = layout(theme);
  const at = (v: number, extra: Partial<CameraKeyframe> = {}): CameraKeyframe => ({t: 0, x: vertical ? 0 : v, y: vertical ? v : 0, ...extra});
  return [
    at(-1.15 * d, {t: 0, scale: 1, rotate: 0}),
    at(-1.15 * d, {t: 0.6}),
    at(0, {t: 3.0}),
    at(0, {t: 3.4, ease: 'spring'}),
    at(0, {t: 6.0, scale: 1.3}),
    at(0, {t: 7.4}),
    at(0.3 * d, {t: 9.2, rotate: 1.6, ease: 'spring'}),
  ];
};

/** Focus schedule for the demo: card A, then card B at {@link RACK_AT}. */
export const cameraDemoFocus: FocusKeyframe[] = [
  {t: 0, layer: 'a'},
  {t: RACK_AT, layer: 'b'},
];

const phase = (t: number): string => {
  if (t < 0.6) return 'hold';
  if (t < 3.0) return 'pan';
  if (t < 3.4) return 'hold';
  if (t < 6.0) return 'push-in · focus on A';
  if (t < RACK_AT) return 'hold';
  if (t < RACK_AT + 0.9) return 'rack focus A → B';
  if (t < 7.4) return 'hold · focus on B';
  if (t < 9.2) return 'roll + drift · focus on B';
  return 'hold';
};

const Backdrop: React.FC<{theme: Theme}> = ({theme}) => {
  const {tint, background} = theme.colors;
  const blob = (left: string, top: string, size: string, c: string): React.CSSProperties => ({position: 'absolute', left, top, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, ${c} 0%, transparent 68%)`});
  return (
    <div style={{position: 'absolute', left: '-45%', top: '-45%', width: '190%', height: '190%', background: `linear-gradient(160deg, ${background.lift}, ${background.base} 45%, ${background.deep})`}}>
      <div style={blob('30%', '28%', '30%', tint.a)} />
      <div style={blob('52%', '40%', '28%', tint.b)} />
      <div style={blob('38%', '56%', '26%', tint.c)} />
      <div style={blob('58%', '22%', '18%', tint.d)} />
    </div>
  );
};

const CardBox: React.FC<{theme: Theme; label: string; sub: string; at: {x: number; y: number}; size: {w: number; h: number}; frame: number; tilt: number}> = ({theme, label, sub, at, size, frame, tilt}) => {
  const {width: w, height: h} = theme.canvas;
  const m = Math.min(w, h);
  return (
    <div style={{position: 'absolute', left: w / 2 + at.x - size.w / 2, top: h / 2 + at.y - size.h / 2, width: size.w, height: size.h}}>
      <Tilt3D rotateY={tilt} rotateX={1.5} sway={{periodSeconds: 9}} frame={frame} theme={theme} width="100%" height="100%">
        <Glass tier="card" width="100%" height="100%" theme={theme} frame={frame} shimmerAt={0.8}>
          <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: m * 0.04, fontFamily: theme.fonts.body, color: theme.colors.text.primary}}>
            <div style={{fontSize: m * 0.075, fontWeight: 700, letterSpacing: -1}}>{label}</div>
            <div style={{fontSize: m * 0.03, color: theme.colors.text.secondary, marginTop: m * 0.01}}>{sub}</div>
          </div>
        </Glass>
      </Tilt3D>
    </div>
  );
};

/** Props for the camera demo. */
export type CameraDemoProps = {
  theme: Theme;
  /** Camera motion blur (default off). */
  motionBlur?: boolean;
  /** Handheld shake (default off). */
  handheld?: boolean;
};

/**
 * Pure demo frame: a 10 s scene with a pan, a push-in and a rack focus between two glass cards, using CameraRig,
 * DepthLayers, RackFocus and Tilt3D together.
 * @example <CameraDemoFrame frame={300} theme={createTheme()} />
 */
export const CameraDemoFrame: React.FC<CameraDemoProps & {frame: number}> = ({frame, theme, motionBlur = false, handheld = false}) => {
  const {w, h, vertical, d, card} = layout(theme);
  const m = Math.min(w, h);
  const t = frame / theme.canvas.fps;
  const posA = vertical ? {x: 0, y: -d} : {x: -d, y: 0};
  const posB = vertical ? {x: 0, y: d} : {x: d, y: 0};
  const Focus: React.FC<{layer: string; children: React.ReactNode}> = ({layer, children}) => (
    <RackFocus frame={frame} theme={theme} focus={cameraDemoFocus}>
      <RackLayer layer={layer}>{children}</RackLayer>
    </RackFocus>
  );
  return (
    <div style={{position: 'absolute', inset: 0, background: theme.colors.background.deep}}>
      <CameraRig frame={frame} theme={theme} keyframes={cameraDemoKeyframes(theme)} motionBlur={motionBlur} handheld={handheld}>
        {(cam) => (
          <DepthLayers camera={cam.state} frame={frame} theme={theme} idle={{amplitude: 10, periodSeconds: 20}}>
            <DepthLayer depth={0}>
              <Focus layer="bg">
                <Backdrop theme={theme} />
              </Focus>
            </DepthLayer>
            <DepthLayer depth={0.35}>
              <Focus layer="a">
                <CardBox theme={theme} label="Card A" sub="depth 0.35 · far" at={posA} size={card} frame={frame} tilt={4} />
              </Focus>
            </DepthLayer>
            <DepthLayer depth={0.7}>
              <Focus layer="b">
                <CardBox theme={theme} label="Card B" sub="depth 0.70 · near" at={posB} size={card} frame={frame} tilt={-4} />
              </Focus>
            </DepthLayer>
          </DepthLayers>
        )}
      </CameraRig>
      <div style={{position: 'absolute', left: m * 0.04, top: m * 0.04, padding: `${m * 0.01}px ${m * 0.02}px`, borderRadius: m * 0.03, background: 'rgba(0,0,0,0.55)', color: '#fff', fontFamily: theme.fonts.body, fontSize: m * 0.03, zIndex: 100}}>
        {t.toFixed(1)}s · {phase(t)}
      </div>
    </div>
  );
};

/**
 * Remotion composition body: reads the frame once (thin wrapper) and passes it to the pure demo.
 * @example <Composition id="Kit-Camera-Demo" component={CameraDemo} ... />
 */
export const CameraDemo: React.FC<CameraDemoProps> = (props) => <CameraDemoFrame frame={useCurrentFrame()} {...props} />;

const CANVASES: {id: string; canvas: Canvas}[] = [
  {id: 'Kit-Camera-Demo', canvas: CANVAS.landscape60},
  {id: 'Kit-Camera-Demo-Vertical', canvas: CANVAS.vertical60},
  {id: 'Kit-Camera-Demo-30fps', canvas: CANVAS.landscape30},
];

/**
 * Registers the three camera demo compositions (16:9 @ 60, 9:16 @ 60, 16:9 @ 30).
 * @example <KitCameraCompositions />
 */
export const KitCameraCompositions: React.FC = () => (
  <>
    {CANVASES.map(({id, canvas}) => (
      <Composition key={id} id={id} component={CameraDemo} durationInFrames={CAMERA_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{theme: createTheme({canvas})}} />
    ))}
  </>
);
