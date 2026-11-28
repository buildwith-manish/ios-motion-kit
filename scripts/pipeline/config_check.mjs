#!/usr/bin/env node
// Validates video.config.json (schema + defaults) and prints the effective values the tools will use.
//   node scripts/pipeline/config_check.mjs [--root <repo>] [--config <file>] [--print]
import {init} from './lib.mjs';
const {cfg, args} = init(undefined, {print: true});
console.log('video.config.json is valid.');
if (args.print) console.log(JSON.stringify(cfg, null, 2));
