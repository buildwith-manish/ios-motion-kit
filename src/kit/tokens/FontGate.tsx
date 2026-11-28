import React from 'react';
import type {ReactNode} from 'react';
import {useKitFonts} from './fonts';

/** Holds the render until the kit fonts are loaded (useKitFonts), then is invisible. Wrap a Root or a composition in it. */
export const KitFontGate: React.FC<{children?: ReactNode}> = ({children}) => {
  useKitFonts();
  return <>{children}</>;
};

/**
 * Wraps a Root component with <KitFontGate>. Use it in every entry: `registerRoot(withKitFonts(Root))`.
 * @example registerRoot(withKitFonts(KitBandingCompositions));
 */
export const withKitFonts = (Root: React.ComponentType): React.FC => {
  const Gated: React.FC = () => (
    <KitFontGate>
      <Root />
    </KitFontGate>
  );
  Gated.displayName = 'KitFontsRoot';
  return Gated;
};
