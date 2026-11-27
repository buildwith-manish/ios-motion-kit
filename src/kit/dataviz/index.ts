/** Data-viz primitives: pure functions of a frame (or progress), animated on iosSpring, styled only from the theme. */
export {toneColor, onToneColor, resolveProgress, springProgress, formatValue, textWidthPx, fitWidth, type Tone, type Timing, type NumberFormat, type DvRect, type DvPoint} from './common';
export {nudge1D, nudgeRects, anyOverlap, type Span1D, type NudgeRect} from './layout';
export {csvToRows, columnNumbers, type DataRow} from './data';
export {layoutBar, barFrameAt, type BarData, type BarOrientation, type BarLayout, type BarLayoutInput, type BarFrame} from './bar';
export {SpringBar, ShortfallBars, type SpringBarProps, type ShortfallBarsProps, type ShortfallBarsData} from './SpringBar';
export {Ring, type RingProps, type RingData} from './Ring';
export {tickerStateAt, tickerEndTime, type TickerRow, type TickerStep, type RowState, type FlipOptions} from './flip';
export {Ticker, type TickerProps} from './Ticker';
export {lineGeometry, lineLayout, pointAtFraction, polylineUpTo, type LinePoint, type LineGeometry, type LineGeometryInput} from './linePath';
export {LineDraw, Sparkline, type LineDrawProps, type SparklineProps} from './LineDraw';
export {Delta, resolveDelta, type DeltaProps, type DeltaData, type ResolvedDelta} from './Delta';
export {layoutCallout, type CalloutData, type CalloutSide, type CalloutLayoutInput, type CalloutLayout, type CalloutItemLayout} from './callout';
export {Callout, type CalloutProps} from './Callout';
export {useSpringProgress} from './hooks';
