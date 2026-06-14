const GEOSEARCH_BASE = 'https://geosearch.planninglabs.nyc/v2/search';

export interface GeoSearchResult {
  label: string;
  borough: string;
  bbl: string;
  latitude: number;
  longitude: number;
  confidence: number;
}

export async function geocodeNYCAddress(rawInput: string): Promise<GeoSearchResult> {
  const url = `${GEOSEARCH_BASE}?text=${encodeURIComponent(rawInput)}&size=1`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.features?.length) throw new Error(`Geocoder: Cannot resolve "${rawInput}"`);
  const feature = data.features[0];
  const props = feature.properties;
  const bbl = props.pad_bbl || props.addendum?.pad?.bbl || props.bbl;
  if (!bbl) throw new Error(`Geocoder: No BBL found for "${rawInput}"`);
  return {
    label: props.label,
    borough: props.borough,
    bbl: String(bbl),
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
    confidence: props.confidence,
  };
}

export function normalizeBoroughCode(borough: string): string {
  const map: Record<string, string> = {
    manhattan: 'MN', bronx: 'BX', brooklyn: 'BK', queens: 'QN', 'staten island': 'SI',
  };
  return map[borough.toLowerCase()] || borough.toUpperCase().slice(0, 2);
}
