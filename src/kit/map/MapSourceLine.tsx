import React from 'react';
import {textStyle, useTheme} from '../tokens';

/** Optional credit line. No on-screen credit is required for Census data; this is a courtesy ("Source: U.S. Census Bureau"). */
export const MapSourceLine: React.FC<{text?: string; style?: React.CSSProperties}> = ({text = 'Source: U.S. Census Bureau', style}) => {
  const theme = useTheme();
  return <div style={{...textStyle(theme, 'caption'), color: theme.colors.text.tertiary, ...style}}>{text}</div>;
};
