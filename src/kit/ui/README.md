# kit/ui

Frame-driven glass UI primitives for explainer scenes. Pass seconds and a frame; each component springs in at `start`
and can spring out at `end`. No component reads the Remotion clock. Styles inherit radius, spacing, type, colour and
glass tiers from the supplied theme or nearest `ThemeProvider`.

```tsx
import {Button, ListGroup, Pill, Widget} from '../kit';

<Pill frame={frame} start={0.3} expandAt={1.2} label="Budget" expandedContent="Monthly plan" />;
<Widget frame={frame} start={0.5} label="Rent" value="$2,000" delta="+2.4%" />;
<ListGroup frame={frame} start={0.8} rows={[{id: 'home', icon: 'wallet', label: 'Housing', value: '$2,000'}]} />;
<Button frame={frame} start={1} pressAt={2.4} label="Review" variant="primary" />;
```

## API

| Export | Purpose | Time-driven props |
| --- | --- | --- |
| `<Pill>` | Compact-to-expanded glass capsule. | `frame`, `start`, `expandAt`, `end` |
| `<Chip>` / `<Badge>` | Compact label and semantic status. | `frame`, `start`, `end` |
| `<Button>` | Primary/secondary visual control with a spring press. | `frame`, `start`, `pressAt`, `end` |
| `<Toggle>` / `<Segmented>` | Animated state and selection indicators. | `frame`, `start`, `changedAt` / `selectionAt`, `end` |
| `<ListGroup>` / `<ListRow>` | Rounded grouped rows with icon tiles and dividers. | `frame`, `start`, `rowStagger`, `end` |
| `<AlertCard>` | Generic icon, title and body card. | `frame`, `start`, `end` |
| `<Widget>` | Label, number, optional sparkline and delta slot. | `frame`, `start`, `end` |
| `<Sheet>` / `<Tooltip>` | Bottom-rising summary surface and anchored hint. | `frame`, `start`, `end` |
| `uiMotionAt`, `springProgress` | Pure presence and spring progress helpers. | seconds, fps and frame |

`src/kit/ui/UiDemo.tsx` registers landscape, vertical and 30 fps dashboard compositions. Use
`src/kit/ui/entry.tsx` with the QA scripts' `--entry` option to inspect them independently.
