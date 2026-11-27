# Kit migration report

## Source
- Repo / branch: `buildwith-manish/PayRanked-video3`, branch **`kit-ios`**
- Commit: **`de681118dcac80932f1a1e1e066aed9d1b2f9454`**
- Result of Step 0: `ALL 7 KITS PRESENT on kit-ios at de681118dcac80932f1a1e1e066aed9d1b2f9454`. `tokens` (with `glass`, `motion`), `text`, `dataviz`, `transitions`, `camera`, `audio` and `qa` are all under `src/kit/` on `kit-ios`. No separate `kit-dataviz` / `kit-qa` branches exist, so nothing was merged. `src/kit/index.ts` already had one `export *` line per kit.

## What was copied
Copied as files (no history; one import commit), nothing was rewritten:
- `src/kit/` (including `src/kit/demo/entry.tsx`), `public/kit/` (118 sfx, 1 music loop + manifest, 1 demo vo; ~22 MB, no file near 50 MB, so no LFS)
- 22 scripts matching `scripts/kit*`, `docs/kit-progress.md`, `docs/kit-audio-cues.txt`, `docs/previews/kit/` (83 images). `docs/kit-*.md` only matched `kit-progress.md`.
- New files written for the standalone project: `package.json` (remotion + `@remotion/*` 4.0.250, react/react-dom 18.3.1, esbuild 0.24.0, playwright-core 1.63.0, typescript ^5.5.4), `tsconfig.json` (copied from PayRanked, strict), `remotion.config.ts`, `.gitignore`, `src/Root.tsx`, `src/index.ts`, `README.md`.
- `three` / `@react-three` / `@remotion/*` extras were **not** added: the kit imports only `react` and `remotion`.

## What was removed / changed to make it standalone
- No kit code needed changing. The kit already had **zero imports from outside `src/kit/`** (verified by `npx tsc --noEmit` passing with only `src/kit` and `src/index.ts` in `src/`), and the scripts contain no PayRanked paths.
- `src/index.ts` + `src/Root.tsx` (new, kit-only) register the same 7 demo groups as `src/kit/demo/entry.tsx`: **23 composition ids, each registered once**. Remotion requires `registerRoot` in the entry file, so a plain `import './kit/demo/entry'` did not work.
- Note: some `src/kit/demo/README.md` lines still say a demo is "registered in entry.tsx only" or "also in src/Root.tsx" (copied unchanged). In this repo every demo is in both.

## Verified
- `npx tsc --noEmit` passes (standalone repo, and the PayRanked `video-4-kit` branch with the alias).
- One still of each of the 23 demo compositions rendered (`docs/previews/migration/`, scale 0.5, swangle). I opened one (`Kit-Dataviz-Demo`) and it looks right. I did not open the other 22.
- README "build a scene" example compiles.
- Alias test in a video repo: `import ... from 'ios-motion-kit'` resolved in both `tsc` and the Remotion webpack bundle, and a symlinked `public/kit` put all 118 sfx files into the bundle.

## Could not verify / failed
- **Step 4 premise does not hold.** `video-4` has no `src/kit/`, no `Kit*Compositions` lines in `Root.tsx` and nothing under `src/video4/` imports a kit. `src/video4/` uses its own `motion4.ts`, `tokens4.ts` and `components/*` (GlassCard, NumberRoll, ...). `kit-ios` branched from `video-4` at `d1cc9d9` (an older point), so `video-4` has 3+ newer commits that `kit-ios` lacks, and `kit-ios` changes `HookScene`, `NumberRoll`, `motion4`, `tokens4`. So there was nothing to repoint or delete. I did **not** rewrite `motion4.ts` / `tokens4.ts` as kit re-exports: that would change how the video renders and the brief said imports only. `video-4-kit` therefore only contains: the submodule at `src/kit-vendor`, the tsconfig `paths` entry, the webpack alias in `remotion.config.ts`, and a `public/kit` symlink.
- **HookScene stills at 1 s / 6 s / 25 s were NOT rendered.** HookScene loads Google Fonts from `fonts.gstatic.com`, which this sandbox's network allow-list blocks (render failed with `ERR_NAME_NOT_RESOLVED`). `docs/previews/video4-kit/` does not exist. HookScene source was not modified on `video-4-kit`, but I cannot confirm the render from here. Run locally: `npx remotion still src/index.ts V4-Hook-Test docs/previews/video4-kit/hook-1s.png --frame=60` (and `--frame=360`, `--frame=1500`).
- **Audio: nobody has listened to it**, me included. The SFX/music are synthesised; only numeric checks exist. Judge by ear.
- **Parallel-render issues: not tested.** Only single stills and a bundle were rendered; no full video, no `--concurrency` run.
- The kit's audit/QA scripts (`kit-audit.mjs`, `kit_*check*.mjs`, `kit-camera-audit.ts`, ...) were **not re-run** in the new repo. Only `tsc` and the stills above were.
- Git history of `src/kit` was not preserved (single import commit).

## Update the kit in a video repo
```bash
git submodule update --remote src/kit-vendor
git add src/kit-vendor && git commit -m "chore: bump ios-motion-kit"
# only if you copied instead of symlinked the assets:
cp -R src/kit-vendor/public/kit/. public/kit/
```
First-time clone of a video repo: `git clone --recurse-submodules <url>` (or `git submodule update --init`). The kit repo is private, so the machine needs access to it.

## Original branches (none deleted)
`PayRanked-video3`: `main`, `video-2`, `video-2-shorts`, `video-3`, `video-3-shorts`, `video-4`, `feat/short-1-vertical`, `kit-ios` (source, unchanged).
New: `PayRanked-video3` / `video-4-kit` (from `video-4`); `ios-motion-kit` / `main`, tag `v0.1.0`.
