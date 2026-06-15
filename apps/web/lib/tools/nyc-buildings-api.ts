import type { SiteViewerGeoJSON, SiteViewerLayerId } from '@/types/zone-draft';

const DATASET_ID = 'jh45-qr5r';
const DEFAULT_HEIGHT_FT = 30;

interface BuildingRecord {
  the_geom?: { type: string; coordinates: number[][][] };
  heightroof?: string;
  groundelev?: string;
  bbl?: string;
  bin?: string;
}

function sodaHeaders(): HeadersInit {
  const token = process.env.NYCOPENDATA_APP_TOKEN;
  return token ? { 'X-App-Token': token } : {};
}

function geomToFeature(
  geom: { type: string; coordinates: number[][][] },
  layer: SiteViewerLayerId,
  heightFt: number,
  bbl?: string
): SiteViewerGeoJSON['features'][0] | null {
  if (!geom?.coordinates?.[0]?.length) return null;
  return {
    type: 'Feature',
    properties: {
      layer,
      height_ft: heightFt,
      extrusion_base_ft: 0,
      bbl,
    },
    geometry: {
      type: 'Polygon',
      coordinates: geom.coordinates,
    },
  };
}

function parseHeight(record: BuildingRecord): number {
  const roof = parseFloat(record.heightroof || '');
  if (!Number.isNaN(roof) && roof > 5) return roof;
  const elev = parseFloat(record.groundelev || '');
  if (!Number.isNaN(elev) && elev > 5) return elev;
  return DEFAULT_HEIGHT_FT;
}

function normalizeBbl(bbl: string | undefined): string {
  if (!bbl) return '';
  return bbl.replace(/\D/g, '').padStart(10, '0');
}

function ringsIntersect(
  a: Array<[number, number]>,
  bCoords: number[][][]
): boolean {
  if (!a.length || !bCoords[0]?.length) return false;
  const bx0 = Math.min(...bCoords[0].map((c) => c[0]));
  const bx1 = Math.max(...bCoords[0].map((c) => c[0]));
  const by0 = Math.min(...bCoords[0].map((c) => c[1]));
  const by1 = Math.max(...bCoords[0].map((c) => c[1]));
  const ax0 = Math.min(...a.map((c) => c[1]));
  const ax1 = Math.max(...a.map((c) => c[1]));
  const ay0 = Math.min(...a.map((c) => c[0]));
  const ay1 = Math.max(...a.map((c) => c[0]));
  return ax0 <= bx1 && ax1 >= bx0 && ay0 <= by1 && ay1 >= by0;
}

export async function fetchNearbyBuildings(
  lat: number,
  lng: number,
  subjectBbl: string,
  lotRing?: Array<[number, number]>,
  radiusM = 200
): Promise<{
  features: SiteViewerGeoJSON['features'];
  warnings: string[];
  useOsmFallback: boolean;
}> {
  const warnings: string[] = [];
  const features: SiteViewerGeoJSON['features'] = [];
  const subjectNorm = normalizeBbl(subjectBbl);

  const where = `within_circle(the_geom, ${lat}, ${lng}, ${radiusM})`;
  const url =
    `https://data.cityofnewyork.us/resource/${DATASET_ID}.json` +
    `?$where=${encodeURIComponent(where)}&$limit=500`;

  try {
    const res = await fetch(url, { headers: sodaHeaders(), cache: 'no-store' });
    if (!res.ok) {
      warnings.push('NYC building footprints API unavailable — OSM fallback used');
      return { features, warnings, useOsmFallback: true };
    }

    const records = (await res.json()) as BuildingRecord[];
    if (!records.length) {
      warnings.push('NYC Open Data buildings query returned 0 features — OSM fallback used');
      return { features, warnings, useOsmFallback: true };
    }

    let defaultedHeights = 0;

    for (const rec of records) {
      if (!rec.the_geom) continue;
      const height = parseHeight(rec);
      if (height === DEFAULT_HEIGHT_FT) defaultedHeights++;

      const recBbl = normalizeBbl(rec.bbl);
      const onLot =
        (recBbl && recBbl === subjectNorm) ||
        (lotRing && ringsIntersect(lotRing, rec.the_geom.coordinates));

      const layer: SiteViewerLayerId = onLot ? 'subject_building' : 'existing_building';
      const feat = geomToFeature(rec.the_geom, layer, height, rec.bbl);
      if (feat) features.push(feat);
    }

    if (defaultedHeights > features.length * 0.5) {
      warnings.push('Building heights defaulted to 30 ft where NYC data missing');
    }

    return { features, warnings, useOsmFallback: false };
  } catch {
    warnings.push('NYC building footprints fetch failed — OSM fallback used');
    return { features, warnings, useOsmFallback: true };
  }
}
