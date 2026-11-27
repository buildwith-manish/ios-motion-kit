/**
 * Time helpers for the kit. The public kit API speaks seconds; these are the only places seconds become frames.
 * Pure functions, no React, no Remotion imports.
 */

/**
 * Seconds -> render frames, rounded to the nearest frame.
 * @example secondsToFrames(0.5, 60) // 30
 */
export const secondsToFrames = (seconds: number, fps: number): number => Math.round(seconds * fps);

/**
 * Render frame -> seconds (fractional between frames).
 * @example framesToSeconds(45, 30) // 1.5
 */
export const framesToSeconds = (frame: number, fps: number): number => frame / fps;
