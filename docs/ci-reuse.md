# Reusing the kit's CI from a video repo

The kit (private repo `buildwith-manish/ios-motion-kit`) ships four reusable workflows. A video repo adds the kit as a submodule
(`kit/`) and calls them. `node scripts/kit_init.mjs <dir>` writes the four caller files below (preview, render, shorts, qa) and
prints the setup steps.

| workflow | does | main inputs |
|---|---|---|
| `reusable-preview.yml` | low-res MP4 + contact sheet + QA report artifacts, optional GitHub Pages | `comps`, `scale`, `fps`, `publish_pages` |
| `reusable-render.yml` | final render in pieces + soundtrack + concat + loudnorm (-14 LUFS, -1.5 dBTP) | `comp`, `quality` (1080p/4K), `chunk_frames`, `force_rerender`, `resume_from_run` |
| `reusable-shorts.yml` | matrix of vertical compositions, h264 crf 16 / slow / aac 320k | `comps` (JSON array), `quality` |
| `reusable-qa.yml` | contrast, safe area, motion, layout lint, loudness gate; fails on violations | `comps`, `times`, `layout_fail`, `loudness_comp` |

All take `entry` (default `src/index.ts`) and `kit_dir` (default `kit`), and require the secret `KIT_TOKEN`.
Pieces are cached per source hash (`force_rerender: true` skips the cache; `resume_from_run` reuses artifacts of an earlier run).

## Caller example (`.github/workflows/qa.yml` in the video repo)

```yaml
name: QA gate
on: { push: { branches: [main] } }
jobs:
  qa:
    permissions: { contents: read, actions: read }
    uses: buildwith-manish/ios-motion-kit/.github/workflows/reusable-qa.yml@reuse-v1
    with:
      comps: 'My-Video'
      entry: src/index.ts
      times: '2,6,10'
      loudness_comp: 'My-Video'
    secrets: inherit
```

Pin `@<tag>` (not `@main`) so a kit change never breaks a render in progress. Add the kit as a submodule over https:
`git submodule add https://github.com/buildwith-manish/ios-motion-kit.git kit`.
The callers' package.json should depend on the same Remotion version as the kit; the kit's scripts are run from `kit/scripts`.

## Private kit setup

The kit repo is private, so three things must be set once. Nothing works until all three are in place.

1. **Access setting** (kit repo): Settings -> Actions -> General -> Access -> "Accessible from repositories owned by the user"
   (or the organization option). Without it, video repos cannot call the kit's workflows.
2. **Fine-grained token**: github.com -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens ->
   Generate. Repository access: *Only select repositories* -> `ios-motion-kit`. Permissions: **Contents: Read-only** (nothing else).
   Set an expiry and note the date.
3. **Secret** (each video repo, or once at user/org level): Settings -> Secrets and variables -> Actions -> `KIT_TOKEN` = the token.
   Callers pass it on with `secrets: inherit`. Every reusable workflow checks out with `submodules: recursive` and
   `token: ${{ secrets.KIT_TOKEN }}`; `npm run kit:fetch-data` also reads `KIT_TOKEN` (or `GH_TOKEN` / `GITHUB_TOKEN`) when the data release is private.

What you see when a step is missing (wording can differ slightly between GitHub versions):

| missing / wrong | symptom |
|---|---|
| Access setting off | the run fails at once: `Invalid workflow file ... error parsing called workflow ... workflow was not found` (or `not accessible by repository`) |
| `KIT_TOKEN` secret not set / not passed | `Invalid workflow file ... Secret KIT_TOKEN is required, but not provided while calling.` (forgot `secrets: inherit`: the same message) |
| token cannot read the kit repo (wrong repo, no Contents: read, expired) | the checkout step fails: `fatal: repository 'https://github.com/buildwith-manish/ios-motion-kit.git/' not found`, `Bad credentials` or HTTP 403 |
| token fine but the submodule URL is `git@github.com:...` | `Permission denied (publickey)` while updating the submodule: use the https URL |
| `kit:fetch-data` without a token on a private kit | `HTTP 404 (private kit repo? set KIT_TOKEN)`; with an invalid token: `HTTP 401/404 reading release ...` |

## Self-test

`kit-main-ci.yml` calls each reusable workflow against the kit's own demo compositions (`kit_dir: '.'`, `KIT_TOKEN` = the run's `GITHUB_TOKEN`)
when the commit message contains `[qa]` or on manual dispatch.

## Data manifest

`data.manifest.json` lists every dataset (id, file, sourceName, url, retrievedDate, dataYear, units, geography, notes, license, sha256).
`npm run kit:data-check [-- --stale-days 365 --write-hashes]` fails on missing fields or a hash mismatch and warns when stale.
In scenes: `sourceLine(['cpi'], manifest)` -> `Source: BLS CPI, 2025, medians`; `assertSumsTo(values, total)`, `assertAllRegionsPresent(byState)`.
