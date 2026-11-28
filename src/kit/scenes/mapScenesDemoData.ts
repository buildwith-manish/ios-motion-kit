/** Data-only example video: hook -> choropleth -> regionHighlight -> tileGrid -> flyToCity -> takeaway -> endCard. No React, no imports of components. */
import type {SceneDefinition} from './types';

/** Illustrative, rounded median monthly gross rent by state (USD). Sample data for the demo, not an official statistic. */
export const SAMPLE_RENT: Readonly<Record<string, number>> = {
  AL: 1000, AK: 1450, AZ: 1400, AR: 900, CA: 1900, CO: 1650, CT: 1400, DE: 1350, DC: 1750, FL: 1550, GA: 1300, HI: 1900, ID: 1200,
  IL: 1200, IN: 1050, IA: 950, KS: 1000, KY: 950, LA: 1000, ME: 1200, MD: 1600, MA: 1700, MI: 1050, MN: 1200, MS: 900, MO: 1000,
  MT: 1100, NE: 1050, NV: 1400, NH: 1450, NJ: 1650, NM: 1000, NY: 1500, NC: 1200, ND: 950, OH: 1000, OK: 950, OR: 1400, PA: 1200,
  RI: 1350, SC: 1200, SD: 950, TN: 1200, TX: 1300, UT: 1400, VT: 1250, VA: 1450, WA: 1650, WV: 850, WI: 1050, WY: 1000,
};

const SOURCE = 'Illustrative sample data, rounded';

export const MAP_SCENES_DEMO_SCENES: readonly SceneDefinition[] = [
  {id: 'hook', type: 'hook', duration: 5, eyebrow: 'Where rent bites', title: 'Same paycheck, very different rent.', body: 'A data-only example: every scene below is plain JSON.'},
  {
    id: 'rent-map', type: 'choropleth', duration: 8, title: 'Median rent by state', subtitle: 'Dollars per month', data: SAMPLE_RENT, format: 'usd',
    legendTitle: 'Median gross rent', source: SOURCE, callouts: [{region: 'CA'}, {region: 'WV'}], reveal: {start: 0.6, spread: 1.6},
  },
  {
    id: 'rent-highlight', type: 'regionHighlight', duration: 9, title: 'Three places, three stories', format: 'usd', source: SOURCE,
    regions: [
      {id: 'CA', label: 'California', value: SAMPLE_RENT.CA, at: 0.8, hold: 2.2},
      {id: 'TX', label: 'Texas', value: SAMPLE_RENT.TX, at: 3.2, hold: 2.2},
      {id: 'WV', label: 'West Virginia', value: SAMPLE_RENT.WV, at: 5.6, hold: 2.2},
    ],
  },
  {id: 'rent-tiles', type: 'tileGrid', duration: 7, title: 'Every state at a glance', subtitle: 'Median rent, $ per month', data: SAMPLE_RENT, format: 'usd', legendTitle: 'Median gross rent', source: SOURCE},
  {
    id: 'fly-nyc', type: 'flyToCity', duration: 12.5, title: 'Zoom in on one city', subtitle: 'New York', city: 'new-york', source: SOURCE,
    countryPins: [{lat: 41.882, lng: -87.635, label: 'Chicago'}, {lat: 40.7128, lng: -74.006, label: 'New York'}],
    arc: {from: {lat: 41.882, lng: -87.635}, to: {lat: 40.7128, lng: -74.006}},
    pins: [{lat: 40.7075, lng: -74.0113, label: 'Lower Manhattan'}, {lat: 40.7549, lng: -73.984, label: 'Midtown'}, {lat: 40.6782, lng: -73.9442, label: 'Brooklyn'}],
    callouts: [
      {lat: 40.7075, lng: -74.0113, title: 'Lower Manhattan', value: 3900, prefix: '$'},
      {lat: 40.7549, lng: -73.984, title: 'Midtown', value: 4300, prefix: '$'},
      {lat: 40.6782, lng: -73.9442, title: 'Brooklyn', value: 3200, prefix: '$'},
    ],
  },
  {id: 'takeaway', type: 'takeaway', duration: 5, eyebrow: 'Takeaway', title: 'Where you live sets your starting line.', body: 'Compare the place, not just the paycheck.'},
  {id: 'end', type: 'endCard', duration: 5, title: 'Build your own map video.', subtitle: 'Describe it as JSON. Render it anywhere.', actionLabel: 'Start with the scenes README'},
];

/** Scene types that get a review still in CI, and where in the scene (share of its duration) the still is taken. */
export const MAP_SCENE_STILL_TYPES = ['choropleth', 'regionHighlight', 'tileGrid', 'flyToCity'] as const;
export const MAP_SCENE_STILL_AT = 0.72;
