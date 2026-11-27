# Region3D reference measurements

Sources (saved here): `portrait-trio.png` (760x557, three panels ~234x417 each), `landscape-florida.png` (778x532), `landscape-michigan.png` (752x480).
All colours are mean-sampled (5x5) from the PNGs. Reference is low-res, so widths are +-1 px.

## Top face
- Gradient direction: lightest teal at upper-left, deep blue at lower-right (diagonal, ~35 deg from horizontal, i.e. along the 'NW -> SE' axis of the shape).
- Stops (portrait Colorado): UL `#328c90` -> centre `#245b76` -> LR `#102d51`.
- Stops (landscape Florida): panhandle `#388d92` -> north `#26647c` -> centre `#1c4b69` -> south `#0e2f51`.
- Stops (landscape Michigan): Upper Peninsula `#35888f` -> lower west `#1d5570` -> centre `#143d5d` -> south `#103557`.
- Not flat: soft, glassy, no visible texture; darkest corner is blue, never grey.

## Rim / chamfer
- ~1 px line (at ~185 px state width) around the top edge. Colour `#5ba4a6` to `#6caaac` (bright, desaturated teal, ~ accent mixed 60% to white).
- Outer halo ~3-4 px: `#2c7e82` falling to bg. Brightest on the left / upper-left edges and the front edge.

## Side walls
- Thickness: front wall ~7 px at 185 px state width (~3.8% of state width, ~4.5% of its longer side in landscape Florida: ~9 px at 340 px).
- Colour upper wall `#0e3540`..`#0f3940` (dark teal, no green), lower wall `#042531` (darker toward the bottom).
- A 1 px lighter glint `#2d6777` / `#1e5f68` directly under the rim.

## Background / vignette
- Base `#07162b`; centre-ish lift `#0b2338`; frame corners `#061529` .. `#071021` (landscape), `#071222` bottom right.
- Soft radial lift behind the shape, falloff to the corners (vignette ~ 0.2 darker at corners).
- Neighbouring states: barely visible, ~ `#0c2340` fill with 1 px lines ~ `#12304a`, fade out ~1 state-width from the shape.

## Ground glow and contact shadow
- Teal glow hugging the shape, strongest on the water/open side (Gulf `#123e4a`, `#0e3145`, peak ~ (390,240) in landscape Florida), radius ~ 0.6 x state width beyond the outline. Fades to bg by ~1 x width.
- Contact shadow: dark, tight under the front/left walls (`#041c27`), ~ 1 wall thickness.

## Camera
- Elevation ~53 deg (Colorado: true 1.36:1 w:h shows 185 x 107 px, ratio 0.58 -> sin(el) ~ 0.8), tiny yaw ~4 deg (top edge rises to the right by 12 px over 185 px).
- Same relative size in every state: portrait ~79% of panel width (Colorado 185/234); landscape Florida bbox 489 x 275 of 778 x 532 (63% x 52%), centred left of the card; Michigan ~ 60% of width.

## Pin and leader line
- Pin: 4 px white dot (`#ffffff`) with a ~14 px soft ring (~ 25% white), sitting at the visual centre of the shape (Colorado centre; Florida central peninsula, Michigan lower peninsula).
- Leader: 1 px line, ~ white at 55% opacity.
- Portrait: vertical for Colorado (pin x == card centre x), diagonal for Michigan/Florida; runs down to the card TOP edge (card top y ~ 350 of panel 75..490, 62%).
- Landscape: runs from pin to the card's LEFT edge (Florida pin (392,234) -> card left edge (563,~199); Michigan (382,292) -> (538,~155)).

## Card
- Portrait: ~81 x 36 px per 234 px panel width (~35% of width), centred horizontally, top at ~62% of frame height.
- Landscape: right side, ~135 x 63 px at 778 wide (~17% width), top at ~31% of height, right margin ~ 5%. Dark translucent glass `#14243e`..`#22314b`, 1 px border `#313d5b`, radius ~ 10 px. Caption `Sample index` muted `#8792a3`; number white, `%` in accent green-teal.

## Title
- Landscape: top-left (x ~ 5% of width, y 12-17%), caption `REGION SPOTLIGHT` accent, small, wide-tracked; name large white bold.
- Portrait: centred at top (y ~ 17-25% of panel).
