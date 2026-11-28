# reuse checklist (reusable CI, data manifest, layout lint, private kit)
- [x] A reusable workflows (preview, render, shorts, qa), self-test jobs, docs/ci-reuse.md, templates/video, kit:init scaffold
- [x] B data.manifest: src/kit/data/manifest.ts, scripts/kit_data_check.mjs, tests; kit:fetch-data uses KIT_TOKEN
- [x] C layout lint: scripts/kit_layout_lint{,_rules}.mjs + config + tests (QA README + reusable-qa step verified)
- [x] private-kit docs section, scaffold prints 3 steps
- [x] tag reuse-v1 (on 1ae62c7)
