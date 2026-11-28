import {registerRoot} from 'remotion';
import {withKitFonts} from '../tokens/FontGate';
import {KitBandingCompositions} from './BandingDemo';

registerRoot(withKitFonts(KitBandingCompositions));
