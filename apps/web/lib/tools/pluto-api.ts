import type { PLUTORecord } from '@/types/zone-draft';
import type { GeoSearchResult } from '@/types/zone-draft';
import { normalizeBoroughCode } from './geocoder';
import { approximateLotPolygon, polygonFromPlutoGeom } from '../lot-geometry';

const PLUTO_SODA_BASE = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';

const BOROUGH_DIGIT_TO_CODE: Record<string, string> = {
  '1': 'MN',
  '2': 'BX',
  '3': 'BK',
  '4': 'QN',
  '5': 'SI',
};

function plutoHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
    'User-Agent': 'Zone-Draft/1.0 (NYC underwriting hackathon)',
  };
  const token = process.env.NYCOPENDATA_APP_TOKEN?.trim();
  // Skip placeholder values — invalid tokens cause 403 from NYC Open Data
  const tokenLooksValid =
    token &&
    token.length > 12 &&
    !token.includes('register_free') &&
    !token.includes('your_');
  if (tokenLooksValid) headers['X-App-Token'] = token;
  return headers;
}

export function normalizeBBL(bbl: string): string {
  const digits = String(bbl).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(0, 10);
  return digits.padStart(10, '0');
}

async function fetchPluto(query: string): Promise<PLUTORecord[]> {
  const url = `${PLUTO_SODA_BASE}?${query}&$limit=1`;
  const response = await fetch(url, { headers: plutoHeaders(), cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`PLUTO API returned ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data;
}

export async function queryPLUTOByAddress(
  address: string,
  borough: string
): Promise<PLUTORecord> {
  const cleanBorough = normalizeBoroughCode(borough);
  const cleanAddress = address.toUpperCase().replace(/'/g, "''");
  const data = await fetchPluto(
    `$where=address='${cleanAddress}' AND borough='${cleanBorough}'`
  );
  if (!data[0]) throw new Error(`PLUTO: No record found for ${address} in ${borough}`);
  return data[0];
}

export async function queryPLUTOByBlockLot(
  borough: string,
  block: string,
  lot: string
): Promise<PLUTORecord> {
  const cleanBorough = normalizeBoroughCode(borough);
  const data = await fetchPluto(
    `borough=${cleanBorough}&block=${block}&lot=${lot}`
  );
  if (!data[0]) throw new Error(`PLUTO: No record for block ${block} lot ${lot} in ${borough}`);
  return data[0];
}

export async function queryPLUTOByBBL(bbl: string): Promise<PLUTORecord> {
  const normalized = normalizeBBL(bbl);

  let data = await fetchPluto(`bbl=${normalized}`);
  if (data[0]) return data[0];

  data = await fetchPluto(`$where=round(bbl)=${normalized}`);
  if (data[0]) return data[0];

  const boroughCode = BOROUGH_DIGIT_TO_CODE[normalized[0]];
  if (boroughCode) {
    const block = String(parseInt(normalized.slice(1, 6), 10));
    const lot = String(parseInt(normalized.slice(6, 10), 10));
    try {
      return await queryPLUTOByBlockLot(boroughCode, block, lot);
    } catch {
      /* try next fallback */
    }
  }

  throw new Error(`PLUTO: No record for BBL ${normalized}`);
}

/** Resolve PLUTO with BBL, block/lot, and address fallbacks from geocoder. */
export async function resolvePLUTO(geo: GeoSearchResult): Promise<PLUTORecord> {
  const normalizedBbl = normalizeBBL(geo.bbl);
  const attempts: string[] = [];

  try {
    return await queryPLUTOByBBL(normalizedBbl);
  } catch (e) {
    attempts.push(e instanceof Error ? e.message : String(e));
  }

  const boroughCode = BOROUGH_DIGIT_TO_CODE[normalizedBbl[0]] || normalizeBoroughCode(geo.borough);
  const block = String(parseInt(normalizedBbl.slice(1, 6), 10));
  const lot = String(parseInt(normalizedBbl.slice(6, 10), 10));
  try {
    return await queryPLUTOByBlockLot(boroughCode, block, lot);
  } catch (e) {
    attempts.push(e instanceof Error ? e.message : String(e));
  }

  const addressCandidates = [geo.streetAddress, geo.label?.split(',')[0]?.trim()].filter(
    Boolean
  ) as string[];

  for (const address of addressCandidates) {
    try {
      return await queryPLUTOByAddress(address, geo.borough);
    } catch (e) {
      attempts.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new Error(
    `PLUTO: Could not resolve BBL ${normalizedBbl} (${attempts.join(' | ')})`
  );
}

export function parseLotData(pluto: PLUTORecord, geo?: { latitude: number; longitude: number }) {
  const lat = geo?.latitude ?? parseFloat(pluto.latitude);
  const lng = geo?.longitude ?? parseFloat(pluto.longitude);
  const frontage = parseFloat(pluto.lotfront) || 0;
  const depth = parseFloat(pluto.lotdepth) || 0;
  const fromGeom = polygonFromPlutoGeom(pluto.the_geom);
  const lot_polygon_coords =
    fromGeom ??
    (lat && lng && frontage > 0 && depth > 0
      ? approximateLotPolygon(lat, lng, frontage, depth)
      : undefined);

  return {
    bbl: normalizeBBL(pluto.bbl),
    address: pluto.address,
    borough: pluto.borough as 'MN' | 'BX' | 'BK' | 'QN' | 'SI',
    block: pluto.block,
    lot: pluto.lot,
    zonedist1: pluto.zonedist1,
    zonedist2: pluto.zonedist2,
    overlay1: pluto.overlay1,
    lot_area_sqft: parseFloat(pluto.lotarea) || 0,
    lot_depth: depth,
    lot_frontage: frontage,
    latitude: lat,
    longitude: lng,
    lot_polygon_coords,
    assessland: parseFloat(pluto.assessland) || 0,
    yearbuilt: parseInt(pluto.yearbuilt) || 0,
    neighborhood: undefined as string | undefined,
  };
}
