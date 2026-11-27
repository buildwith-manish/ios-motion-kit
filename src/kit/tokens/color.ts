/**
 * Small colour helpers (pure).
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * '#rgb' | '#rrggbb' + alpha (0-1) -> 'rgba(r,g,b,a)'. Alpha is clamped.
 * @example rgba('#FFFFFF', 0.16) // 'rgba(255,255,255,0.16)'
 */
export const rgba = (hex: string, alpha: number): string => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.round(clamp01(alpha) * 1000) / 1000})`;
};
