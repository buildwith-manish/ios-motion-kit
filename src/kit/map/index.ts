/** Map kit: Census-based, baked static data, no network at render. */
export * from './types';
export * from './projection';
export * from './styles';
export {MapCanvas, useMap, type MapCanvasProps} from './MapCanvas';
export {MapLayer, type MapLayerProps} from './MapLayer';
export {RegionLayer, useBakedTopo, featureById, allFeatures, type RegionLayerProps} from './RegionLayer';
export {CityLayer, useCity, cityAlignmentTransform, CITY_STROKE_PX, type CityData, type CityAlignment, type CityLayerProps} from './CityLayer';
export {MapSourceLine} from './MapSourceLine';
export * from './regions';
export {useRegionShapes, regionFile} from './useRegionShapes';
export * from './highlight';
export {FocusDim, type FocusDimProps} from './FocusDim';
export {RegionHighlight, HIGHLIGHT_BLUR_PX, type RegionHighlightProps} from './RegionHighlight';
export {HighlightStage, type HighlightStageProps} from './HighlightStage';
