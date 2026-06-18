import { NextResponse } from 'next/server';
import { getSession, getRoomSchema } from '@/lib/session-store';
import { buildSiteGeometry } from '@/lib/site-geometry';
import { resolveTaxLotPolygon } from '@/lib/tools/nyc-tax-lot-api';
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

function centroidFromRing(ring: Array<[number, number]>): { lat: number; lng: number } {
  const lat = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lng = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return { lat, lng };
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

  const lotPolygon = await resolveTaxLotPolygon(
    lot.bbl,
    lot.lot_polygon_coords,
    {
      lat: lot.latitude,
      lng: lot.longitude,
      frontage: lot.lot_frontage,
      depth: lot.lot_depth,
    }
  );

  const lotForGeometry = {
    ...lot,
    lot_polygon_coords:
      lotPolygon.coords.length >= 3 ? lotPolygon.coords : lot.lot_polygon_coords,
  };

  const geometry = await buildSiteGeometry(lotForGeometry, zoning, 'both');

  const allWarnings = [...lotPolygon.warnings, ...geometry.meta.data_warnings];
  const uniqueWarnings = [...new Set(allWarnings)];
  const envelopeMethodFromLot =
    lotPolygon.source === 'rectangle_fallback' || geometry.meta.envelope_method === 'rectangle_fallback'
      ? 'rectangle_fallback'
      : 'polygon';

  const ring =
    lotPolygon.coords.length >= 3
      ? lotPolygon.coords
      : lot.lot_polygon_coords ??
        ([
          [lot.latitude - 0.0002, lot.longitude - 0.0002],
          [lot.latitude - 0.0002, lot.longitude + 0.0002],
          [lot.latitude + 0.0002, lot.longitude + 0.0002],
          [lot.latitude + 0.0002, lot.longitude - 0.0002],
        ] as Array<[number, number]>);

  const center =
    ring.length >= 3 ? centroidFromRing(ring) : { lat: lot.latitude, lng: lot.longitude };

  const payload: SiteViewerPayload = {
    sessionId,
    address: lot.address,
    bbl: lot.bbl,
    zonedist1: lot.zonedist1,
    center,
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
    layers: geometry.layers,
    meta: {
      envelope_method: envelopeMethodFromLot,
      lot_polygon_source: lotPolygon.source,
      data_warnings: uniqueWarnings,
      map_engine: 'openfreemap_maplibre',
    },
  };

  cache.set(sessionId, { at: Date.now(), payload });
  return NextResponse.json(payload);
}
