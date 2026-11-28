import {registerRoot} from 'remotion';
import {withKitFonts} from '../tokens/FontGate';
import {KitFinishCompositions} from './FinishDemo';

registerRoot(withKitFonts(KitFinishCompositions));
