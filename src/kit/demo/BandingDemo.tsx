import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {Finish, type DitherSetting} from '../finish';
import {CANVAS, createTheme, ThemeProvider} from '../tokens';

interface BandingDemoProps extends Record<string, unknown> {
  /** Dither setting passed to Finish; scripts/kit_banding_check.mjs renders it off and on. */
  dither?: DitherSetting;
}

/** A smooth, very dark left-to-right gradient (theme deep to base) under Finish's vignette: the worst case for 8-bit banding. */
export const BandingGradientFrame: React.FC<BandingDemoProps & {frame: number}> = ({dither = 'off', frame}) => {
  const theme = createTheme({canvas: CANVAS.landscape30});
  return (
    <ThemeProvider theme={theme}>
      <Finish level="light" dither={dither} frame={frame}>
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${theme.colors.background.deep}, ${theme.colors.background.base})`}} />
      </Finish>
    </ThemeProvider>
  );
};

const CompositionFrame: React.FC<BandingDemoProps> = (props) => <BandingGradientFrame frame={useCurrentFrame()} {...props} />;

export const KitBandingCompositions: React.FC = () => (
  <Composition id="Kit-Banding-Gradient" component={CompositionFrame} durationInFrames={2} width={CANVAS.landscape30.width} height={CANVAS.landscape30.height} fps={30} defaultProps={{dither: 'off' as DitherSetting}} />
);
