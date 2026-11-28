/** Own entry for the number-roll review demo: npx remotion studio src/kit/demo/numberRollEntry.tsx */
import {registerRoot} from 'remotion';
import {withKitFonts} from '../tokens/FontGate';
import {KitNumberRollCompositions} from './NumberRollDemo';

registerRoot(withKitFonts(KitNumberRollCompositions));
