import type { GeoSearchResult } from '@/types/zone-draft';
import { parseSiteInput, normalizeBBLInput } from '../parse-site-input';
import { queryPLUTOByBBL } from './pluto-api';

const GEOSEARCH_BASE = 'https://geosearch.planninglabs.nyc/v2/search';

const BOROUGH_NAMES: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
};

export async function geocodeNYCAddress(rawInput: string): Promise<GeoSearchResult> {
  const parsed = parseSiteInput(rawInput);

  if (parsed.kind === 'bbl' && parsed.bbl) {
    const normalized = normalizeBBLInput(parsed.bbl);
    const boroughDigit = normalized[0];
    try {
      const pluto = await queryPLUTOByBBL(normalized);
      const lat = parseFloat(pluto.latitude);
      const lng = parseFloat(pluto.longitude);
      return {
        label: pluto.address || `BBL ${normalized}`,
        borough: pluto.borough || BOROUGH_NAMES[boroughDigit] || 'Queens',
        bbl: normalized,
        streetAddress: pluto.address,
        latitude: Number.isFinite(lat) ? lat : 40.75,
        longitude: Number.isFinite(lng) ? lng : -73.95,
        confidence: 1,
      };
    } catch {
      return {
        label: `BBL ${normalized}`,
        borough: BOROUGH_NAMES[boroughDigit] || 'Queens',
        bbl: normalized,
        streetAddress: undefined,
        latitude: 40.75,
        longitude: -73.95,
        confidence: 1,
      };
    }
  }

  const url = `${GEOSEARCH_BASE}?text=${encodeURIComponent(parsed.raw)}&size=1`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.features?.length) {
    throw new Error(`Geocoder: Cannot resolve "${rawInput}"`);
  }

  const feature = data.features[0];
  const props = feature.properties;
  const bbl =
    props.pad_bbl ||
    props.addendum?.pad?.bbl ||
    props.bbl;

  if (!bbl) {
    throw new Error(`Geocoder: No BBL found for "${rawInput}"`);
  }

  return {
    label: props.label,
    borough: props.borough,
    bbl: String(bbl).replace(/\D/g, '').padStart(10, '0').slice(0, 10),
    streetAddress: props.name || props.label?.split(',')[0]?.trim(),
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
    confidence: props.confidence,
  };
}

export function normalizeBoroughCode(borough: string): string {
  const map: Record<string, string> = {
    manhattan: 'MN',
    bronx: 'BX',
    brooklyn: 'BK',
    queens: 'QN',
    'staten island': 'SI',
    mn: 'MN',
    bx: 'BX',
    bk: 'BK',
    qn: 'QN',
    si: 'SI',
  };
  return map[borough.toLowerCase()] || borough.toUpperCase().slice(0, 2);
}
