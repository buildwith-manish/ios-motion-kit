// Pure layout-lint rules (design rules from the old video 3 system, thresholds in kit_layout_lint.config.json).
// Roles are tagged in the scene DOM with data-qa-role="hero|label|support|secondary|chip|rail|footer".
// Input: one frame. Output: [{rule, label, detail, severity, path}]. Units: design px (caller scales rects/sizes).
export const ROLES = ['hero', 'label', 'support', 'secondary', 'chip', 'rail', 'footer'];
const inter = (a, b) => ({w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)});
const hit = (rule, o, detail, severity, extra = {}) => ({rule, label: o.label ?? o.path ?? rule, detail, severity, path: o.path ?? rule, ...extra});

export const checkConfig = (cfg) => {
  const z = cfg.heroZone;
  const share = ((z.right - z.left) * (z.bottom - z.top)) / (cfg.frame.width * cfg.frame.height);
  return share >= cfg.heroZoneMinShare ? [] : [hit('hero-zone-share', {label: 'config'}, `hero zone is ${(share * 100).toFixed(0)}% of the frame, rule is >= ${cfg.heroZoneMinShare * 100}%`, 1)];
};

/** texts: [{path,text,size,opacity,ignored}], items: [{role,path,label,box:{left,top,right,bottom},size,opacity}] */
export const lintFrame = ({texts, items}, cfg) => {
  const out = [];
  const vis = (o) => !o.ignored && o.opacity >= cfg.minOpacity;
  for (const t of texts) if (vis(t) && t.size > 0 && t.size < cfg.minText - 0.5) out.push(hit('text-floor', {label: t.text.slice(0, 40), path: t.path}, `${t.size.toFixed(0)} px < ${cfg.minText} px`, cfg.minText - t.size));
  const shown = items.filter(vis);
  for (const o of shown) {
    if (o.role === 'label' && o.size > 0 && o.size < cfg.minLabel - 0.5) out.push(hit('label-min', o, `${o.size.toFixed(0)} px < ${cfg.minLabel} px`, cfg.minLabel - o.size));
    if (o.role === 'hero') {
      if (o.size > 0 && (o.size < cfg.hero.min - 0.5 || o.size > cfg.hero.max + 0.5)) out.push(hit('hero-size', o, `${o.size.toFixed(0)} px outside ${cfg.hero.min}-${cfg.hero.max}`, Math.abs(o.size - Math.min(cfg.hero.max, Math.max(cfg.hero.min, o.size)))));
      const z = cfg.heroZone; const b = o.box; const tol = cfg.overlapTolerancePx;
      const over = Math.max(z.left - b.left, z.top - b.top, b.right - z.right, b.bottom - z.bottom);
      if (over > tol) out.push(hit('hero-zone', o, `hero leaves the hero zone by ${Math.round(over)} px`, over));
    }
  }
  const heroes = shown.filter((o) => o.role === 'hero');
  if (heroes.length > 1) out.push(hit('one-hero', {label: 'hero', path: 'heroes'}, `${heroes.length} heroes on screen, rule is 1`, heroes.length - 1));
  const sec = shown.filter((o) => o.role === 'secondary');
  if (sec.length > cfg.maxSecondary) out.push(hit('max-secondary', {label: 'secondary', path: 'secondary'}, `${sec.length} secondary elements, max ${cfg.maxSecondary}`, sec.length - cfg.maxSecondary));
  const chips = items.filter((o) => o.role === 'chip' && !o.ignored && o.opacity >= cfg.chipVisibleOpacity);
  if (chips.length > 1) out.push(hit('chips-one-at-a-time', {label: 'chip', path: 'chips'}, `${chips.length} chips visible together`, chips.length - 1));
  const tol = cfg.overlapTolerancePx;
  for (const o of shown) {
    if (o.role === 'rail' || o.role === 'footer') continue;
    for (const [name, s] of [['rail', cfg.rail], ['footer', cfg.footer]]) {
      const i = inter(o.box, s);
      if (i.w > tol && i.h > tol) out.push(hit('strip-overlap', o, `overlaps the ${name} strip by ${Math.round(i.w)}x${Math.round(i.h)} px`, Math.min(i.w, i.h)));
    }
  }
  const body = shown.filter((o) => !['rail', 'footer'].includes(o.role));
  for (let a = 0; a < body.length; a++) for (let b = a + 1; b < body.length; b++) {
    const p = body[a]; const q = body[b];
    if (p.path.startsWith(q.path) || q.path.startsWith(p.path)) continue; // nested, not an overlap
    const i = inter(p.box, q.box);
    if (i.w > tol && i.h > tol) out.push(hit('overlap', p, `overlaps ${q.label} by ${Math.round(i.w)}x${Math.round(i.h)} px`, Math.min(i.w, i.h), {path: `${p.path}|${q.path}`}));
  }
  return out;
};

/**
 * maxSimultaneous: at one sampled frame, at most cfg.maxSimultaneous (default 3) secondary elements may be visible
 * with opacity > 0.5; hero, rail and footer are excluded. items: [{role,path,label,opacity,ignored}] from data-kit-role.
 * Returns {skipped, findings}; a frame with no role-tagged items is skipped (caller warns).
 */
export const checkMaxSimultaneous = (items, cfg) => {
  const max = cfg.maxSimultaneous ?? 3;
  const tagged = items.filter((o) => !o.ignored && ROLES.includes(o.role));
  if (tagged.length === 0) return {skipped: true, findings: []};
  const sec = tagged.filter((o) => o.role === 'secondary' && o.opacity > 0.5);
  const findings = sec.length > max ? [hit('max-simultaneous', {label: 'secondary', path: 'simultaneous'}, `${sec.length} secondary elements visible together (opacity > 0.5), max ${max}`, sec.length - max)] : [];
  return {skipped: false, findings};
};
