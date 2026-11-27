# T4 — Camera and motion upgrades

## Built

- Added bounded underdamped spring bounce and the `hero` preset; camera keyframes preserve the overshoot and land on the next keyframe.
- Added deterministic `lookAt` targeting for canvas rectangles and caller-supplied element rectangle maps.
- Camera blur now includes apparent zoom/roll movement; camera and transition blur use a capped seven-sample average along the travel vector.
- Added a DepthLayers before/after comparison to the camera demo and updated camera, motion, and transition API documentation.

## Visual review

- Reviewed `camera-landscape-60-1.8-pan.jpg`, `camera-landscape-60-4.7-pushin.jpg`, `camera-landscape-60-8.3-roll.jpg`, `camera-vertical-60-1.8-pan.jpg`, and `camera-depth-compare-4k-crop.jpg`.
- The vertical pan shows the second card entering from outside the frame as intended; no visible rendering defect was found.

## QA

| Check | Before | After |
| --- | --- | --- |
| Contrast (four camera compositions) | Five findings: four persistent low-contrast lines and one transient | 0 findings |
| Title-safe area (four camera compositions) | Eight findings across landscape, vertical, and 30 fps demos | 0 findings |
| Numeric camera audit | — | All assertions pass |
| TypeScript | — | `npx tsc --noEmit` passes |
| Motion audit | Not completed locally | Pending GitHub Actions run |

Contrast logs: `T4-contrast.txt` and `T4-contrast-final.txt`; safe-area logs: `T4-safe-area.txt` and `T4-safe-area-confirm.txt`.

## NOT verified

- Final four-composition motion audit is pending GitHub Actions.
- No full-motion video playback or cross-browser comparison.
- No render-concurrency or performance benchmark for the seven-sample directional filter.
