// Prints key=value lines (for $GITHUB_OUTPUT) for a preset in render-presets.json. Empty name prints nothing.
//   node scripts/kit_preset_env.mjs final-4k
import {readFileSync} from 'node:fs';
const name = process.argv[2] ?? '';
if (name) {
  const {presets} = JSON.parse(readFileSync(new URL('../render-presets.json', import.meta.url), 'utf8'));
  const p = presets[name];
  if (!p) { console.error(`unknown preset ${name}; one of: ${Object.keys(presets).join(', ')}`); process.exit(1); }
  console.log(`preset_scale=${p.scale}\npreset_crf=${p.crf}\npreset_xp=${p.x264Preset}\npreset_ab=${p.audioBitrate}`);
}
