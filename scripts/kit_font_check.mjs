// Pure rules for "no fallback font in a frame". Input comes from collectFontState() in kit_qa_page.mjs.
// faces: [{family, weight, status}] (document.fonts); used: [{family, weight, count, sample, loaded}] (text on screen).

/** Problems found, as strings; empty means every kit face is loaded and all on-screen text uses it. */
export const fontProblems = ({faces, used}, {family = 'Inter', weights = [600, 700], allowFamilies = []} = {}) => {
  const out = [];
  const mine = faces.filter((f) => f.family === family);
  if (mine.length === 0) out.push(`no "${family}" FontFace registered: every frame would use a fallback font`);
  for (const f of mine) if (f.status !== 'loaded') out.push(`${family} ${f.weight} has status "${f.status}", expected "loaded"`);
  for (const w of weights) if (!mine.some((f) => f.status === 'loaded' && Number(f.weight) === w)) out.push(`${family} ${w}: no loaded face`);
  for (const u of used) {
    if (u.family === family) {
      if (!u.loaded) out.push(`${u.count} text element(s) use ${family} ${u.weight} but document.fonts.check() is false (e.g. "${u.sample}")`);
    } else if (!allowFamilies.includes(u.family)) {
      out.push(`${u.count} text element(s) render in "${u.family}" ${u.weight}, not ${family} (e.g. "${u.sample}")`);
    }
  }
  return out;
};
