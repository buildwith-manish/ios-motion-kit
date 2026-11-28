# Region3D reference notes (Michigan, landscape)

Files: `reference-michigan-landscape.png` (the target, 752x480) and `current-michigan-landscape.png` (earlier render, 937x581, for comparison).
Only Michigan landscape is available as a reference so far; Colorado, Florida and portrait values are still to be sampled.

## Sampled pixels (reference)
| Element | Colour |
|---|---|
| Background top-left | #09152a |
| Background centre glow | #0c1e38 |
| Background bottom-right | #071021 |
| Vignette, left edge | #071429 |
| Top face, upper-left (Upper Peninsula) | #378c92 |
| Top face, upper-mid | #31798a |
| Top face, lower peninsula upper-left | #1f5772 |
| Top face, lower peninsula centre | #14415d |
| Top face, lower-right | #112d53 |
| Side wall (south) | #123f4d |
| Ground glow, left of shape | #113b51 |
| Glass card fill | #21314c |
| Pin dot | #e6e9f5 |

## Look
- Top face: teal (upper-left) to deep blue (lower-right), diagonal, glassy; never flat grey-blue.
- Thin bright teal rim around the top edge; thin teal walls, darker toward the bottom.
- Soft teal ground glow and contact shadow under the shape; faint low-contrast neighbours.
- Pin: small light dot with a faint ring; thin light leader line to the card's left edge (landscape).
- Card: glass, upper right; title block top-left ("REGION SPOTLIGHT" in accent teal, state name below).

## Baseline render of kit-map f8b8db4 (CI run 46032261616) vs reference
Side by side: `compare-baseline-michigan-landscape.png` (left = CI render, right = reference). Correction: my first note called the card too light; that was a bad pixel sample. Card fill is already close (CI #22395c vs ref #21314c).
- Upper Peninsula top face: CI #28a3a4 (greener, more saturated) vs ref #358f93 (greyer).
- Lower peninsula: CI #176081 / #13496a vs ref #1d516d / #143f5e (CI slightly bluer, lighter at the upper-left).
- Reference has a stronger tilt (taller visible walls), a larger shape in frame, a stronger teal glow on the west/south walls and ground, and neighbours drawn as darker filled shapes with faint outlines.
- Reference text is Inter; CI render falls back to a DejaVu-style font (likely missing font in CI).
- Reference card is smaller relative to the frame.
