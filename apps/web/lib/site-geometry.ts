import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import type { SiteViewerGeoJSON, SiteViewerLayerId } from '@/types/zone-draft';
import { readResponseJson } from './http-json';
import { approximateLotPolygon } from './lot-geometry';

const GEO_AGENT_URL = process.env.GEO_AGENT_URL || 'http://localhost:8000';
const FT_TO_M = 0.3048;
const FLOOR_HEIGHT_FT = 10.5;

const BASE_FAR: Record<string, { res: number; uap: number | null; sky_exp_base: number }> = {
  'R1-1': { res: 0.5, uap: null, sky_exp_base: 25 },
  'R3-2': { res: 0.5, uap: null, sky_exp_base: 25 },
  R6: { res: 2.43, uap: 3.0, sky_exp_base: 60 },
  R7A: { res: 3.45, uap: 4.6, sky_exp_base: 60 },
  R7X: { res: 3.75, uap: 4.6, sky_exp_base: 85 },
  R8: { res: 6.02, uap: 7.2, sky_exp_base: 85 },
  R8A: { res: 6.02, uap: 7.2, sky_exp_base: 60 },
  R9A: { res: 7.52, uap: 9.0, sky_exp_base: 60 },
  R10: { res: 10.0, uap: 12.0, sky_exp_base: 85 },
  'C6-1': { res: 6.0, uap: 7.2, sky_exp_base: 85 },
  'C6-2A': { res: 6.0, uap: 7.2, sky_exp_base: 60 },
  'C6-4': { res: 10.0, uap: 12.0, sky_exp_base: 85 },
  'M1-5/R7X': { res: 3.75, uap: 4.6, sky_exp_base: 85 },
  'M1-5/R8A': { res: 6.02, uap: 7.2, sky_exp_base: 85 },
  'M1-6/R10': { res: 10.0, uap: 12.0, sky_exp_base: 85 },
};

function lookupFar(zonedist: string) {
  if (BASE_FAR[zonedist]) return BASE_FAR[zonedist];
  for (const key of Object.keys(BASE_FAR)) {
    if (zonedist.startsWith(key.split('/')[0])) return BASE_FAR[key];
  }
  return BASE_FAR.R7X;
}

function latLngRingToPolygon(ring: Array<[number, number]>): GeoJSON.Polygon {
  const coords = ring.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

function feetToDegreesBuffer(lat: number, feet: number): number {
  return (feet * FT_TO_M) / 111_320;
}

function shrinkPolygon(
  ring: Array<[number, number]>,
  insetFt: number
): Array<[number, number]> {
  const insetDeg = feetToDegreesBuffer(ring[0][0], insetFt);
  const centroidLat = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const centroidLng = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return ring.map(([lat, lng]) => {
    const dLat = lat - centroidLat;
    const dLng = lng - centroidLng;
    const scale = Math.max(0.35, 1 - insetDeg / Math.max(Math.abs(dLat), Math.abs(dLng), 1e-9));
    return [centroidLat + dLat * scale, centroidLng + dLng * scale] as [number, number];
  });
}

function envelopeMetrics(
  lotArea: number,
  footprintArea: number,
  far: number,
  skyBase: number
) {
  const gfa = lotArea * far;
  const floors = Math.ceil(gfa / Math.max(footprintArea, 1));
  const height = floors * FLOOR_HEIGHT_FT;
  const setback = height > skyBase ? (height - skyBase) / 85 : 0;
  return { gfa, floors, height, setback };
}

function makeFeature(
  layer: SiteViewerLayerId,
  ring: Array<[number, number]>,
  props: Record<string, unknown>
) {
  return {
    type: 'Feature' as const,
    properties: { layer, ...props },
    geometry: latLngRingToPolygon(ring),
  };
}

export async function fetchGeoAgentGeometry(
  lotData: NonNullable<ZoneDraftRoomSchema['lot_data']>,
  zoning: NonNullable<ZoneDraftRoomSchema['zoning_analysis']> | null,
  scenario: 'uap' | 'base' | 'both' = 'both'
): Promise<{
  layers: SiteViewerGeoJSON;
  metrics: Record<string, number>;
  meta: { envelope_method: string; data_warnings: string[] };
} | null> {
  try {
    const res = await fetch(`${GEO_AGENT_URL}/compute-site-geometry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lot_data: lotData,
        zoning_analysis: zoning,
        scenario,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = await readResponseJson<{ error?: string } & Record<string, unknown>>(res);
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildSiteGeometryLocal(
  lotData: NonNullable<ZoneDraftRoomSchema['lot_data']>,
  zoning: NonNullable<ZoneDraftRoomSchema['zoning_analysis']> | null,
  scenario: 'uap' | 'base' | 'both' = 'both'
): {
  layers: SiteViewerGeoJSON;
  metrics: {
    height_ft: number;
    floors: number;
    gfa_sqft: number;
    base_far: number;
    uap_far: number;
    sky_exposure_base_ft: number;
  };
  meta: { envelope_method: 'polygon' | 'rectangle_fallback'; data_warnings: string[] };
} {
  const warnings: string[] = ['Geo-agent unreachable — using TypeScript Turf-style fallback geometry'];
  const z = zoning ?? lookupFar(lotData.zonedist1);
  const farLookup = lookupFar(lotData.zonedist1);
  const rearYard = zoning?.rear_yard_ft ?? 30;
  const skyBase = zoning?.sky_exposure_base_ft ?? farLookup.sky_exp_base;
  const baseFar = zoning?.base_far ?? farLookup.res;
  const uapFar = zoning?.uap_far ?? farLookup.uap ?? baseFar;

  let ring = lotData.lot_polygon_coords;
  let envelopeMethod: 'polygon' | 'rectangle_fallback' = 'polygon';

  if (!ring || ring.length < 3) {
    envelopeMethod = 'rectangle_fallback';
    warnings.push('Lot polygon approximated from frontage × depth (no PLUTO the_geom)');
    ring = approximateLotPolygon(
      lotData.latitude,
      lotData.longitude,
      lotData.lot_frontage || 50,
      lotData.lot_depth || 100
    );
  }

  const buildable = shrinkPolygon(ring, rearYard);
  const footprintArea = lotData.lot_area_sqft * 0.65;

  const features: SiteViewerGeoJSON['features'] = [
    makeFeature('lot_boundary', ring, { height_ft: 2, bbl: lotData.bbl }),
    makeFeature('buildable_footprint', buildable, { height_ft: 1, bbl: lotData.bbl }),
  ];

  let primaryMetrics = { height_ft: 0, floors: 0, gfa_sqft: 0 };

  const addEnvelope = (layer: SiteViewerLayerId, far: number) => {
    const m = envelopeMetrics(lotData.lot_area_sqft, footprintArea, far, skyBase);
    const topRing = m.setback > 0 ? shrinkPolygon(buildable, m.setback * FT_TO_M * 3) : buildable;
    if (m.setback > 0 && m.height > skyBase) {
      features.push(
        makeFeature(layer, buildable, {
          height_ft: skyBase,
          extrusion_base_ft: 0,
          floors: m.floors,
          gfa_sqft: m.gfa,
        })
      );
      features.push(
        makeFeature(layer, topRing, {
          height_ft: m.height,
          extrusion_base_ft: skyBase,
          floors: m.floors,
          gfa_sqft: m.gfa,
        })
      );
    } else {
      features.push(
        makeFeature(layer, buildable, {
          height_ft: m.height,
          extrusion_base_ft: 0,
          floors: m.floors,
          gfa_sqft: m.gfa,
        })
      );
    }
    return m;
  };

  if (scenario === 'uap' || scenario === 'both') {
    const m = addEnvelope('envelope_uap', uapFar);
    primaryMetrics = { height_ft: m.height, floors: m.floors, gfa_sqft: m.gfa };
  }
  if (scenario === 'base' || scenario === 'both') {
    const m = addEnvelope('envelope_base', baseFar);
    if (scenario === 'base') {
      primaryMetrics = { height_ft: m.height, floors: m.floors, gfa_sqft: m.gfa };
    }
  }

  features.push(
    makeFeature('sky_exposure_plane', ring, {
      height_ft: skyBase + 0.5,
      extrusion_base_ft: Math.max(0, skyBase - 0.5),
      label: 'Sky exposure reference',
    })
  );

  if (zoning?.zoning_approximated) {
    warnings.push('Zoning district approximated in lookup table');
  }

  return {
    layers: { type: 'FeatureCollection', features },
    metrics: {
      ...primaryMetrics,
      base_far: baseFar,
      uap_far: uapFar,
      sky_exposure_base_ft: skyBase,
    },
    meta: { envelope_method: envelopeMethod, data_warnings: warnings },
  };
}

export async function buildSiteGeometry(
  lotData: NonNullable<ZoneDraftRoomSchema['lot_data']>,
  zoning: NonNullable<ZoneDraftRoomSchema['zoning_analysis']> | null,
  scenario: 'uap' | 'base' | 'both' = 'both'
) {
  const fromAgent = await fetchGeoAgentGeometry(lotData, zoning, scenario);
  if (fromAgent?.layers) {
    return {
      layers: fromAgent.layers as SiteViewerGeoJSON,
      metrics: {
        height_ft: fromAgent.metrics.height_ft ?? 0,
        floors: fromAgent.metrics.floors ?? 0,
        gfa_sqft: fromAgent.metrics.gfa_sqft ?? 0,
        base_far: fromAgent.metrics.base_far ?? 0,
        uap_far: fromAgent.metrics.uap_far ?? 0,
        sky_exposure_base_ft: fromAgent.metrics.sky_exposure_base_ft ?? 85,
      },
      meta: {
        envelope_method: (fromAgent.meta.envelope_method as 'polygon' | 'rectangle_fallback') ?? 'polygon',
        data_warnings: fromAgent.meta.data_warnings ?? [],
      },
    };
  }
  return buildSiteGeometryLocal(lotData, zoning, scenario);
}
