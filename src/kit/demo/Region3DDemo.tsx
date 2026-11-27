import React from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, ThemeProvider, useTheme, type Canvas, type ThemeName} from '../index';
import {Region3D} from '../map/three';

const SECONDS = 3;
const Scene: React.FC<{id: string}> = ({id}) => {
  const theme = useTheme();
  const t = useCurrentFrame() / theme.canvas.fps;
  return (
    <AbsoluteFill style={{background: theme.colors.background.base}}>
      <Region3D id={id} t={t} duration={SECONDS} />
    </AbsoluteFill>
  );
};

const SHAPES: {key: string; canvas: Canvas}[] = [{key: 'Landscape', canvas: CANVAS.landscape60}, {key: 'Portrait', canvas: CANVAS.vertical60}];

/** Kit-Region3D-<Landscape|Portrait> (props: theme, id): one extruded state, 3 s. Timing spike, three is only imported here. */
export const KitRegion3DCompositions: React.FC = () => (
  <>
    {SHAPES.map(({key, canvas}) => (
      <Composition
        key={key}
        id={`Kit-Region3D-${key}`}
        durationInFrames={SECONDS * canvas.fps}
        width={canvas.width}
        height={canvas.height}
        fps={canvas.fps}
        component={({theme, id}: {theme: ThemeName; id: string}) => (
          <ThemeProvider theme={createTheme({canvas}, theme)}>
            <Scene id={id} />
          </ThemeProvider>
        )}
        defaultProps={{theme: 'midnight' as ThemeName, id: '08'}}
      />
    ))}
  </>
);
