import { normalizeBBL } from './pluto-api';
import { polygonFromPlutoGeom, approximateLotPolygon } from '../lot-geometry';
import proj4 from 'proj4';

const NY_STATE_PLANE = 'EPSG:2263';
proj4.defs(
  NY_STATE_PLANE,
  '+proj=lcc +lat_1=41.03333333333334 +lat_2=40.66666666666666 +lat_0=40.16666666666666 +lon_0=-74 +x_0=300000 +y_0=0 +ellps=GRS80 +units=us-ft +no_defs'
);

function isStatePlaneCoord(lngOrX: number, latOrY: number): boolean {
  return Math.abs(lngOrX) > 180 || Math.abs(latOrY) > 90;
}

function toLatLng(lngOrX: number, latOrY: number): [number, number] {
  if (isStatePlaneCoord(lngOrX, latOrY)) {
    const [lng, lat] = proj4(NY_STATE_PLANE, 'EPSG:4326', [lngOrX, latOrY]);
    return [lat, lng];
  }
  return [latOrY, lngOrX];
}

function ringFromGeoJsonGeometry(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): Array<[number, number]> | null {
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    if (!ring?.length) return null;
    return ring.map(([a, b]) => toLatLng(a, b));
  }
  if (geometry.type === 'MultiPolygon' && geometry.coordinates[0]?.[0]?.length) {
    return geometry.coordinates[0][0].map(([a, b]) => toLatLng(a, b));
  }
  return null;
}

const ZONING_API_BASE = 'https://zoning-api.nycplanningdigital.com/api/tax-lots';
const ARCGIS_MAPPLUTO_QUERY =
  'https://services5.arcgis.com/GfwWNkhOj9b4RvQl/arcgis/rest/services/MAPPLUTO/FeatureServer/0/query';

export type TaxLotSource = 'zoning_api' | 'mappluto_arcgis' | 'stored_pluto' | 'rectangle_fallback';

export interface TaxLotPolygonResult {
  coords: Array<[number, number]>;
  source: TaxLotSource;
  warnings: string[];
}

async function fetchZoningApiLot(bbl: string): Promise<Array<[number, number]> | null> {
  try {
    const res = await fetch(`${ZONING_API_BASE}/${bbl}/geojson`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GeoJSON.Feature | GeoJSON.FeatureCollection;
    const feature =
      data.type === 'FeatureCollection' ? data.features?.[0] : data;
    if (!feature?.geometry) return null;
    return ringFromGeoJsonGeometry(feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon);
  } catch {
    return null;
  }
}

async function fetchArcGisMapplutoLot(bbl: string): Promise<Array<[number, number]> | null> {
  try {
    const bblNum = parseInt(bbl, 10);
    const where = `bbl=${bblNum}`;
    const url =
      `${ARCGIS_MAPPLUTO_QUERY}?` +
      `where=${encodeURIComponent(where)}&outFields=bbl&returnGeometry=true&f=geojson`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as GeoJSON.FeatureCollection;
    const feature = data.features?.[0];
    if (!feature?.geometry) return null;
    return ringFromGeoJsonGeometry(feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon);
  } catch {
    return null;
  }
}

/**
 * Resolve authoritative tax-lot polygon for Site Viewer.
 * Priority: NYC Zoning API → ArcGIS MapPLUTO → stored PLUTO geom → rectangle fallback.
 */
export async function resolveTaxLotPolygon(
  bbl: string,
  storedCoords?: Array<[number, number]>,
  fallback?: { lat: number; lng: number; frontage: number; depth: number }
): Promise<TaxLotPolygonResult> {
  const normalized = normalizeBBL(bbl);
  const warnings: string[] = [];

  const fromZoning = await fetchZoningApiLot(normalized);
  if (fromZoning && fromZoning.length >= 3) {
    return { coords: fromZoning, source: 'zoning_api', warnings };
  }

  const fromArcGis = await fetchArcGisMapplutoLot(normalized);
  if (fromArcGis && fromArcGis.length >= 3) {
    warnings.push('NYC Zoning API unavailable — using ArcGIS MapPLUTO lot boundary');
    return { coords: fromArcGis, source: 'mappluto_arcgis', warnings };
  }

  if (storedCoords && storedCoords.length >= 3) {
    warnings.push('Using MapPLUTO geometry from underwriting session');
    return { coords: storedCoords, source: 'stored_pluto', warnings };
  }

  if (fallback) {
    warnings.push('Lot polygon approximated from frontage × depth — verify BBL on NYC ZoLa');
    return {
      coords: approximateLotPolygon(
        fallback.lat,
        fallback.lng,
        fallback.frontage || 50,
        fallback.depth || 100
      ),
      source: 'rectangle_fallback',
      warnings,
    };
  }

  return { coords: [], source: 'rectangle_fallback', warnings: ['Could not resolve lot polygon'] };
}

export function coordsFromPlutoGeom(
  geom?: { type: string; coordinates: number[][][] }
): Array<[number, number]> | undefined {
  return polygonFromPlutoGeom(geom);
}
