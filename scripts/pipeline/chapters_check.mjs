#!/usr/bin/env node
// kit:chapters-check: same as `chapters.mjs --check` (reads the existing chapters txt, fails under 10 s or when the first is not 0:00).
import {run} from './chapters.mjs';
process.exit(run([...process.argv.slice(2), '--check']));
