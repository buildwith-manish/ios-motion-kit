/** Separate entry for the optional 3D insert, so the main demo bundle never pulls in three. */
import React from 'react';
import {registerRoot} from 'remotion';
import {withKitFonts} from '../tokens/FontGate';
import {KitRegion3DCompositions} from './Region3DDemo';

registerRoot(withKitFonts(() => <KitRegion3DCompositions />));
