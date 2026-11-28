#!/usr/bin/env bash
# Creates the release named in data-manifest.json and uploads its files from this checkout. Needs gh + GH_TOKEN.
# Does nothing if the release already has every asset (releases are never overwritten).
set -euo pipefail
cd "$(dirname "$0")/.."
tag=$(node -p "require('./data-manifest.json').release")
have=$(gh release view "$tag" --json assets --jq '.assets[].name' 2>/dev/null || true)
missing=$(node -e "const have=new Set(process.argv[1].split('\n'));for(const f of require('./data-manifest.json').files) if(!have.has(f.name)) console.log(f.name+' '+f.dest)" "$have")
if [ -z "$missing" ]; then echo "release $tag is complete"; exit 0; fi
node scripts/kit_fetch_data.mjs --check
gh release view "$tag" >/dev/null 2>&1 || gh release create "$tag" --title "Kit data ($tag)" --notes "Large generated files kept out of git. Fetch with: npm run kit:fetch-data"
stage=$(mktemp -d)
while read -r name dest; do cp "$dest" "$stage/$name"; done <<< "$missing"
gh release upload "$tag" "$stage"/*
