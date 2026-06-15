import { NextResponse } from 'next/server';
import { getSession, getRoomSchema } from '@/lib/session-store';
import { buildSiteGeometry } from '@/lib/site-geometry';
import { fetchNearbyBuildings } from '@/lib/tools/nyc-buildings-api';
import type { SiteViewerPayload } from '@/types/zone-draft';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; payload: SiteViewerPayload }>();

function computeBbox(
  coords: Array<[number, number]>,
  paddingDeg = 0.0015
): [number, number, number, number] {
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  return [
    Math.min(...lngs) - paddingDeg,
    Math.min(...lats) - paddingDeg,
    Math.max(...lngs) + paddingDeg,
    Math.max(...lats) + paddingDeg,
  ];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const cached = cache.get(sessionId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  const schema = session.bandRoomId ? getRoomSchema(session.bandRoomId) : null;
  if (!schema?.lot_data || !schema.zoning_analysis || !schema.building_envelope) {
    return NextResponse.json(
      { error: 'Run underwriting first — lot, zoning, and envelope data required' },
      { status: 422 }
    );
  }

  const lot = schema.lot_data;
  const zoning = schema.zoning_analysis;
  const envelope = schema.building_envelope;
  const financial = schema.financial_analysis;

  const geometry =
    schema.site_geometry_geojson && schema.site_geometry_geojson.features?.length
      ? {
          layers: schema.site_geometry_geojson,
          metrics: {
            height_ft: envelope.total_height_ft ?? envelope.floors_with_uap * 10.5,
            floors: envelope.floors_with_uap,
            gfa_sqft: envelope.gross_floor_area,
            base_far: zoning.base_far,
            uap_far: zoning.uap_far,
            sky_exposure_base_ft: zoning.sky_exposure_base_ft,
          },
          meta: {
            envelope_method: 'polygon' as const,
            data_warnings: [] as string[],
          },
        }
      : await buildSiteGeometry(lot, zoning, 'both');

  const buildings = await fetchNearbyBuildings(
    lot.latitude,
    lot.longitude,
    lot.bbl,
    lot.lot_polygon_coords
  );

  const allWarnings = [
    ...geometry.meta.data_warnings,
    ...buildings.warnings,
  ];

  const layers = {
    type: 'FeatureCollection' as const,
    features: [...geometry.layers.features, ...buildings.features],
  };

  const ring =
    lot.lot_polygon_coords ??
    ([
      [lot.latitude - 0.0002, lot.longitude - 0.0002],
      [lot.latitude - 0.0002, lot.longitude + 0.0002],
      [lot.latitude + 0.0002, lot.longitude + 0.0002],
      [lot.latitude + 0.0002, lot.longitude - 0.0002],
    ] as Array<[number, number]>);

  const payload: SiteViewerPayload = {
    sessionId,
    address: lot.address,
    bbl: lot.bbl,
    zonedist1: lot.zonedist1,
    center: { lat: lot.latitude, lng: lot.longitude },
    bbox: computeBbox(ring),
    camera: { zoom: 17, pitch: 60, bearing: -20 },
    metrics: {
      height_ft: envelope.total_height_ft ?? geometry.metrics.height_ft,
      floors: envelope.floors_with_uap ?? geometry.metrics.floors,
      gfa_sqft: envelope.gross_floor_area ?? geometry.metrics.gfa_sqft,
      verdict: financial?.deal_verdict,
      base_far: zoning.base_far,
      uap_far: zoning.uap_far,
      sky_exposure_base_ft: zoning.sky_exposure_base_ft,
    },
    layers,
    meta: {
      existing_building_count: buildings.features.filter(
        (f) => f.properties.layer === 'existing_building'
      ).length,
      envelope_method: geometry.meta.envelope_method,
      data_warnings: allWarnings,
      use_osm_buildings_fallback: buildings.useOsmFallback,
    },
  };

  cache.set(sessionId, { at: Date.now(), payload });
  return NextResponse.json(payload);
}
