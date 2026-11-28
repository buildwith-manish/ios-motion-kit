/** Own entry for the number-format demo: npx remotion studio src/kit/demo/formatEntry.tsx */
import {registerRoot} from 'remotion';
import {withKitFonts} from '../tokens/FontGate';
import {KitFormatCompositions} from './FormatDemo';

registerRoot(withKitFonts(KitFormatCompositions));
