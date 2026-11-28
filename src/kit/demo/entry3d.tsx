/** Separate entry for the optional 3D insert, so the main demo bundle never pulls in three. */
import React from 'react';
import {registerRoot} from 'remotion';
import {KitRegion3DCompositions} from './Region3DDemo';

registerRoot(() => <KitRegion3DCompositions />);
