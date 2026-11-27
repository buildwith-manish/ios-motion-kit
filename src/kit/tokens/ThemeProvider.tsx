import React, {createContext, useContext} from 'react';
import type {ReactNode} from 'react';
import {midnight} from './themes';
import type {Theme} from './types';

const ThemeContext = createContext<Theme>(midnight);

/**
 * Supplies a theme to every kit component below it. Without a provider, components use `midnight`.
 * @example <ThemeProvider theme={createTheme({}, 'light')}><Glass tier="card" frame={frame}>Hi</Glass></ThemeProvider>
 */
export const ThemeProvider: React.FC<{theme: Theme; children?: ReactNode}> = ({theme, children}) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

/**
 * Returns the nearest theme. Thin hook wrapper; it only reads React context, never the Remotion frame.
 * @example const theme = useTheme(); theme.colors.accent
 */
export const useTheme = (): Theme => useContext(ThemeContext);
