#!/usr/bin/env bash
# Turns everything under docs/previews into review-size JPGs (max 960 px wide, quality 80). Needs ImageMagick.
# Run after rendering review stills and before committing them; 4K originals belong in CI artifacts.
set -euo pipefail
cd "$(dirname "$0")/.."
find docs/previews -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0 | while IFS= read -r -d '' f; do
  width=$(identify -format '%w' "$f")
  case "$f" in
    *.png) convert "$f" -resize '960x>' -strip -quality 80 "${f%.*}.jpg" && rm "$f" ;;
    *) if [ "$width" -gt 960 ]; then mogrify -resize '960x>' -strip -quality 80 "$f"; fi ;;
  esac
done
du -sh docs/previews
