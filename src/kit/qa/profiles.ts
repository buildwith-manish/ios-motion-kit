/** Render profiles (draft / review / final) and the pure planning behind scripts/kit_render.mjs. No React, no Node APIs. */

/**
 * One render profile.
 * @example const half: RenderProfile = {...RENDER_PROFILES.review, scale: 0.5};
 */
export interface RenderProfile {
  description: string;
  /** Output size relative to the composition (1 = full resolution, 2 on a 1080p composition = 4K). */
  scale: number;
  /** Target frame rate. A composition is never sped up or interpolated: see {@link planRender}. */
  fps: number;
  crf: number;
  x264Preset: 'veryfast' | 'fast' | 'slow';
  /** Intermediate frame format. */
  imageFormat: 'jpeg' | 'png';
  jpegQuality: number;
  audioBitrate: '160k' | '256k' | '320k';
  /**
   * Motion-blur sample count offered to compositions as the input prop `kitRender.motionBlurSamples`. It only has an
   * effect on code that reads it (see {@link motionBlurSamples}); nothing is forced on a composition.
   */
  motionBlurSamples: number;
}

/**
 * The three profiles.
 * @example RENDER_PROFILES.final.crf // 16
 */
export const RENDER_PROFILES = {
  draft: {description: 'half scale, 30 fps, quick look', scale: 0.5, fps: 30, crf: 28, x264Preset: 'veryfast', imageFormat: 'jpeg', jpegQuality: 80, audioBitrate: '160k', motionBlurSamples: 1},
  review: {description: 'full size, 60 fps, low motion-blur samples', scale: 1, fps: 60, crf: 20, x264Preset: 'fast', imageFormat: 'jpeg', jpegQuality: 92, audioBitrate: '256k', motionBlurSamples: 3},
  final: {description: 'full size, 60 fps, CRF 16 slow, PNG frames, 320k audio', scale: 1, fps: 60, crf: 16, x264Preset: 'slow', imageFormat: 'png', jpegQuality: 100, audioBitrate: '320k', motionBlurSamples: 8},
} as const satisfies Record<string, RenderProfile>;

/**
 * Name of a render profile.
 * @example const name: RenderProfileName = 'draft';
 */
export type RenderProfileName = keyof typeof RENDER_PROFILES;

/**
 * Reads the sample count a profile passed in; use it where a composition configures its own motion blur.
 * @example <CameraMotionBlur samples={motionBlurSamples(props, 6)}>...</CameraMotionBlur>
 */
export const motionBlurSamples = (props: {kitRender?: {motionBlurSamples?: number}} | undefined, fallback: number): number =>
  props?.kitRender?.motionBlurSamples ?? fallback;

/**
 * What will actually be rendered.
 * @example const seconds = (p: RenderPlan) => p.frames / p.outputFps;
 */
export interface RenderPlan {
  /** Render every Nth composition frame. 1 = all frames. */
  everyNthFrame: number;
  outputFps: number;
  /** Frame range (inclusive) in composition frames. */
  firstFrame: number;
  lastFrame: number;
  frames: number;
  width: number;
  height: number;
}

/**
 * Turns a profile into a concrete plan. Frames are only ever dropped (by a whole number), so a 30 fps composition
 * stays 30 fps under a 60 fps profile and a 60 fps one becomes 30 fps in draft with identical timing. Throws if the
 * scaled size is odd or fractional, which H.264 4:2:0 cannot encode.
 * @example planRender(RENDER_PROFILES.draft, {fps: 60, width: 1920, height: 1080, durationInFrames: 600}).frames // 300
 */
export const planRender = (
  profile: Pick<RenderProfile, 'fps' | 'scale'>,
  comp: {fps: number; width: number; height: number; durationInFrames: number},
  range: {start?: number; end?: number} = {},
): RenderPlan => {
  const everyNthFrame = Math.max(1, Math.floor(comp.fps / profile.fps + 1e-9));
  const firstFrame = Math.max(0, Math.round((range.start ?? 0) * comp.fps));
  const lastFrame = Math.min(comp.durationInFrames, range.end === undefined ? comp.durationInFrames : Math.round(range.end * comp.fps)) - 1;
  if (lastFrame < firstFrame) throw new Error('planRender: empty time range');
  const width = comp.width * profile.scale;
  const height = comp.height * profile.scale;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width % 2 || height % 2) throw new Error(`planRender: ${width}x${height} is not an even whole size; change --scale`);
  return {everyNthFrame, outputFps: comp.fps / everyNthFrame, firstFrame, lastFrame, frames: Math.floor((lastFrame - firstFrame) / everyNthFrame) + 1, width, height};
};
