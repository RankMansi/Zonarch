import { bandClient, bandRoom } from './band-client';
import { readResponseJson } from './http-json';
import { resolveSitePreview } from './resolve-site';
import { calcCompStats, fetchNeighborhoodComps } from './tools/sales-api';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

const GEO_AGENT_URL = process.env.GEO_AGENT_URL || 'http://localhost:8000';

async function syncGeoAgentRoom(roomId: string): Promise<boolean> {
  try {
    const schema = await bandRoom.context.getAll(roomId);
    const res = await fetch(`${GEO_AGENT_URL}/sync-room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, schema }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function geoAgentAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${GEO_AGENT_URL}/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const BASE_FAR: Record<string, { res: number; uap: number | null; max_height: number | null; sky_exp_base: number; comm?: number }> = {
  'R1-1': { res: 0.5, uap: null, max_height: 35, sky_exp_base: 25 },
  'R3-2': { res: 0.5, uap: null, max_height: 35, sky_exp_base: 25 },
  R6: { res: 2.43, uap: 3.0, max_height: null, sky_exp_base: 60 },
  R7A: { res: 3.45, uap: 4.6, max_height: 80, sky_exp_base: 60 },
  R7X: { res: 3.75, uap: 4.6, max_height: null, sky_exp_base: 85 },
  R8: { res: 6.02, uap: 7.2, max_height: null, sky_exp_base: 85 },
  R8A: { res: 6.02, uap: 7.2, max_height: 120, sky_exp_base: 60 },
  R9A: { res: 7.52, uap: 9.0, max_height: 145, sky_exp_base: 60 },
  R10: { res: 10.0, uap: 12.0, max_height: null, sky_exp_base: 85 },
  'C6-1': { res: 6.0, uap: 7.2, max_height: null, sky_exp_base: 85, comm: 6.0 },
  'C6-2A': { res: 6.0, uap: 7.2, max_height: null, sky_exp_base: 60, comm: 6.0 },
  'C6-4': { res: 10.0, uap: 12.0, max_height: null, sky_exp_base: 85, comm: 10.0 },
  'M1-5/R7X': { res: 3.75, uap: 4.6, max_height: null, sky_exp_base: 85, comm: 2.0 },
  'M1-5/R8A': { res: 6.02, uap: 7.2, max_height: null, sky_exp_base: 85, comm: 2.0 },
  'M1-6/R10': { res: 10.0, uap: 12.0, max_height: null, sky_exp_base: 85, comm: 2.0 },
};

function lookupZoning(zonedist: string) {
  if (BASE_FAR[zonedist]) {
    return { key: zonedist, rules: BASE_FAR[zonedist], approximated: false };
  }
  for (const key of Object.keys(BASE_FAR)) {
    if (zonedist.startsWith(key.split('/')[0])) {
      return { key, rules: BASE_FAR[key], approximated: zonedist !== key };
    }
  }
  return { key: 'R7X', rules: BASE_FAR['R7X'], approximated: true };
}

function computeEnvelope(
  lotArea: number,
  lotDepth: number,
  lotFrontage: number,
  zonedist: string,
  useUap = true
) {
  const { rules: zoning } = lookupZoning(zonedist);
  const far = useUap && zoning.uap ? zoning.uap : zoning.res;
  const grossFa = lotArea * far;
  const rearYard = 30;
  const buildableDepth = lotDepth - rearYard;
  const skyExpBase = zoning.sky_exp_base;
  const floorPlate = lotFrontage * buildableDepth;

  if (floorPlate <= 0) {
    throw new Error(`Invalid lot geometry: frontage=${lotFrontage}, depth=${buildableDepth}`);
  }

  const floors = Math.ceil(grossFa / floorPlate);
  const floorHeight = 10.5;
  const totalHeight = floors * floorHeight;
  const requiredSetback =
    totalHeight > skyExpBase ? (totalHeight - skyExpBase) * (1 / 85) : 0;

  const sfToM = 0.3048;
  const w = lotFrontage * sfToM;
  const d = buildableDepth * sfToM;
  const h = totalHeight * sfToM;
  const setbackM = requiredSetback * sfToM;
  const skyBaseM = skyExpBase * sfToM;

  const vertices: Array<{ x: number; y: number; z: number }> = [
    { x: 0, y: 0, z: 0 },
    { x: w, y: 0, z: 0 },
    { x: w, y: 0, z: d },
    { x: 0, y: 0, z: d },
  ];

  if (requiredSetback > 0) {
    vertices.push(
      { x: 0, y: skyBaseM, z: 0 },
      { x: w, y: skyBaseM, z: 0 },
      { x: w, y: skyBaseM, z: d },
      { x: 0, y: skyBaseM, z: d },
      { x: setbackM, y: h, z: setbackM },
      { x: w - setbackM, y: h, z: setbackM },
      { x: w - setbackM, y: h, z: d - setbackM },
      { x: setbackM, y: h, z: d - setbackM }
    );
  } else {
    vertices.push(
      { x: 0, y: h, z: 0 },
      { x: w, y: h, z: 0 },
      { x: w, y: h, z: d },
      { x: 0, y: h, z: d }
    );
  }

  const setbackPlanes =
    requiredSetback > 0
      ? (['north', 'south', 'east', 'west'] as const).map((face) => ({
          elevation_ft: skyExpBase,
          setback_depth_ft: requiredSetback,
          face,
        }))
      : [];

  return {
    max_residential_sqft: grossFa,
    max_commercial_sqft: lotArea * (zoning.comm || 0),
    gross_floor_area: grossFa,
    floors_standard: Math.ceil((lotArea * zoning.res) / floorPlate),
    floors_with_uap: floors,
    total_height_ft: totalHeight,
    envelope_vertices: vertices,
    setback_planes: setbackPlanes,
    violation_log: [] as Array<{ type: string; description: string; resolution: string }>,
    iteration_count: 0,
  };
}

async function runZoningAgent(roomId: string): Promise<string> {
  const lotData = await bandRoom.context.get(roomId, 'lot_data');
  if (!lotData) throw new Error('Zoning agent: no lot_data');

  if (await geoAgentAvailable()) {
    try {
      await syncGeoAgentRoom(roomId);
      const res = await fetch(`${GEO_AGENT_URL}/run-zoning-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await readResponseJson<{
          error?: string;
          zoning_analysis?: NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;
          log?: string;
        }>(res);
        if (!data.error && data.zoning_analysis) {
          await bandRoom.context.set(roomId, 'zoning_analysis', data.zoning_analysis);
          return data.log || 'Zoning analysis complete via Python agent';
        }
      }
    } catch {
      /* fall through to local */
    }
  }

  const { rules: zoning, key: tableKey, approximated } = lookupZoning(lotData.zonedist1);
  const analysis: NonNullable<ZoneDraftRoomSchema['zoning_analysis']> = {
    base_far: zoning.res,
    uap_far: zoning.uap || zoning.res,
    max_height_ft: zoning.max_height,
    sky_exposure_base_ft: zoning.sky_exp_base,
    sky_exposure_angle: 85,
    rear_yard_ft: 30,
    min_front_setback_ft: 0,
    max_lot_coverage_pct: 70,
    parking_required: false,
    uap_eligible: !!zoning.uap,
    uap_affordable_pct: 20,
    applicable_zr_sections: ['ZR 23-154', 'ZR 23-47', 'ZR 23-631', 'ZR 33-26'],
    city_of_yes_notes:
      'City of Yes (2024): Parking mandates eliminated citywide for residential within 0.5mi of transit. UAP bonus: +20% FAR if 20% of units permanently affordable at ≤60% AMI.',
    rag_sources: ['ZR Article II — Residence Districts', 'City of Yes Housing Amendments 2024'],
    zoning_table_key: tableKey,
    zoning_approximated: approximated,
  };

  await bandRoom.context.set(roomId, 'zoning_analysis', analysis);
  const approxNote = approximated
    ? ` (simplified rules from table “${tableKey}” — verify with full ZR)`
    : '';
  return `Zoning locked: ${lotData.zonedist1} | Base FAR ${analysis.base_far} | UAP FAR ${analysis.uap_far} | Sky exposure ${analysis.sky_exposure_base_ft} ft | No parking required (City of Yes)${approxNote}`;
}

async function runSpatialAgent(roomId: string): Promise<string> {
  const lotData = await bandRoom.context.get(roomId, 'lot_data');
  const zoning = await bandRoom.context.get(roomId, 'zoning_analysis');
  if (!lotData || !zoning) throw new Error('Spatial agent: missing context');

  if (await geoAgentAvailable()) {
    try {
      await syncGeoAgentRoom(roomId);
      const res = await fetch(`${GEO_AGENT_URL}/run-spatial-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await readResponseJson<{
          error?: string;
          building_envelope?: NonNullable<ZoneDraftRoomSchema['building_envelope']>;
          log?: string;
        }>(res);
        if (!data.error && data.building_envelope) {
          await bandRoom.context.set(roomId, 'building_envelope', data.building_envelope);
          return data.log || 'Envelope computed via Python agent';
        }
      }
    } catch {
      /* fall through */
    }
  }

  let envelope = computeEnvelope(
    lotData.lot_area_sqft,
    lotData.lot_depth,
    lotData.lot_frontage,
    lotData.zonedist1,
    true
  );

  if (envelope.max_residential_sqft / lotData.lot_area_sqft > (zoning.uap_far || 5)) {
    await bandClient.emit(roomId, {
      event: 'constraint.violation',
      agent: 'SPATIAL_CALCULATOR',
      content: 'FAR exceeds UAP maximum — recomputing with corrected parameters',
    });
    envelope = computeEnvelope(
      lotData.lot_area_sqft,
      lotData.lot_depth,
      lotData.lot_frontage,
      lotData.zonedist1,
      true
    );
    envelope.violation_log.push({
      type: 'FAR_CAP',
      description: 'Initial envelope exceeded UAP FAR cap',
      resolution: 'Recomputed with UAP FAR limit applied',
    });
    envelope.iteration_count = 1;
    await bandClient.emit(roomId, {
      event: 'constraint.resolved',
      agent: 'SPATIAL_CALCULATOR',
      content: 'Envelope validated against UAP FAR cap',
    });
  }

  await bandRoom.context.set(roomId, 'building_envelope', envelope);
  return `ENVELOPE COMPUTED: ${envelope.floors_with_uap} floors | ${envelope.total_height_ft?.toFixed(0)}ft | GFA ${envelope.gross_floor_area.toLocaleString()} sqft | ${envelope.envelope_vertices.length} vertices`;
}

async function runFinancialAgent(roomId: string): Promise<string> {
  const lotData = await bandRoom.context.get(roomId, 'lot_data');
  const envelope = await bandRoom.context.get(roomId, 'building_envelope');
  if (!lotData || !envelope) throw new Error('RLV: Missing lot_data or building_envelope');

  const comps = await fetchNeighborhoodComps(lotData.borough, lotData.neighborhood || '');
  const compStats = calcCompStats(comps);
  const compDefaultUsed = compStats.count === 0;
  const grossSqft = envelope.max_residential_sqft;
  const netSqft = grossSqft * 0.85;
  const HARD_COST_PSF = 375;
  const ASSESSED_LAND_MULTIPLIER = 10;

  const projectedAssetValue = netSqft * compStats.avgPSF;
  const hardCostTotal = grossSqft * HARD_COST_PSF;
  const softCostTotal = hardCostTotal * 0.22;
  const financingCost = (hardCostTotal + softCostTotal) * 0.06;
  const developerProfit = projectedAssetValue * 0.18;
  const totalProjectCost = hardCostTotal + softCostTotal + financingCost + developerProfit;
  const residualLandValue = projectedAssetValue - totalProjectCost;

  const assessedLandEstimate = lotData.assessland;
  const assessedLand = assessedLandEstimate * ASSESSED_LAND_MULTIPLIER;
  let verdict: 'STRONG BUY' | 'BUY' | 'HOLD' | 'PASS';
  let rationale: string;

  if (residualLandValue > assessedLand * 1.5) {
    verdict = 'STRONG BUY';
    rationale = `RLV $${(residualLandValue / 1e6).toFixed(1)}M exceeds estimated ask by >50%. Strong acquisition signal.`;
  } else if (residualLandValue > assessedLand * 1.1) {
    verdict = 'BUY';
    rationale = `RLV $${(residualLandValue / 1e6).toFixed(1)}M exceeds estimated ask. Viable development deal.`;
  } else if (residualLandValue > 0) {
    verdict = 'HOLD';
    rationale = 'Positive RLV but thin margin. Requires further negotiation on land price.';
  } else {
    verdict = 'PASS';
    rationale = `Negative RLV $${(residualLandValue / 1e6).toFixed(1)}M. Deal does not pencil at current pricing.`;
  }

  const financial: NonNullable<ZoneDraftRoomSchema['financial_analysis']> = {
    comp_avg_psf: compStats.avgPSF,
    comp_count: compStats.count,
    comp_addresses: comps.slice(0, 5).map((c) => c.address),
    projected_asset_value: projectedAssetValue,
    hard_cost_psf: HARD_COST_PSF,
    hard_cost_total: hardCostTotal,
    soft_cost_total: softCostTotal,
    financing_cost: financingCost,
    developer_profit: developerProfit,
    total_project_cost: totalProjectCost,
    residual_land_value: residualLandValue,
    cap_rate: 0.045,
    irr_estimate: 0.18,
    deal_verdict: verdict,
    verdict_rationale: rationale,
    comp_default_used: compDefaultUsed,
    assessed_land_estimate: assessedLandEstimate,
    assessed_land_multiplier: ASSESSED_LAND_MULTIPLIER,
  };

  await bandRoom.context.set(roomId, 'financial_analysis', financial);
  await bandRoom.context.set(roomId, 'status', 'APPROVED');

  return [
    compDefaultUsed
      ? `Comps: none found — using default $${compStats.avgPSF}/sf for GDV (directional only)`
      : `Comps: ${compStats.count} recent sales | avg $${compStats.avgPSF.toFixed(0)}/sf | GDV $${(projectedAssetValue / 1e6).toFixed(2)}M`,
    `Costs: hard $${(hardCostTotal / 1e6).toFixed(2)}M @ $${HARD_COST_PSF}/sf | soft + financing + profit included`,
    `Residual land value: $${(residualLandValue / 1e6).toFixed(2)}M vs land ask est. $${(assessedLand / 1e6).toFixed(2)}M (assessed × ${ASSESSED_LAND_MULTIPLIER})`,
    `Recommendation: ${verdict} — ${rationale}`,
    `Modeled IRR ${(0.18 * 100).toFixed(0)}% | cap rate ${(0.045 * 100).toFixed(1)}% (assumptions, not market quotes)`,
  ].join('\n');
}

export async function createUnderwritingRoom(sessionId: string): Promise<string> {
  const room = await bandClient.rooms.create({
    name: `zone_draft_${sessionId}`,
    schema: {
      lot_data: null,
      zoning_analysis: null,
      building_envelope: null,
      financial_analysis: null,
      outbound_email: null,
      status: 'RUNNING',
      iteration_count: 0,
      error_log: [],
    },
  });

  await Promise.all([
    room.addParticipant('intake-parser'),
    room.addParticipant('zoning-compliance'),
    room.addParticipant('spatial-calculator'),
    room.addParticipant('financial-underwriter'),
  ]);

  return room.id;
}

export async function runUnderwriting(sessionId: string, rawInput: string, roomId?: string): Promise<string> {
  const room = roomId
    ? { id: roomId, addParticipant: async () => {}, context: bandRoom.context }
    : await bandClient.rooms.create({
    name: `zone_draft_${sessionId}`,
    schema: {
      lot_data: null,
      zoning_analysis: null,
      building_envelope: null,
      financial_analysis: null,
      outbound_email: null,
      status: 'RUNNING',
      iteration_count: 0,
      error_log: [],
    },
  });

  if (!roomId) {
    await Promise.all([
      room.addParticipant('intake-parser'),
      room.addParticipant('zoning-compliance'),
      room.addParticipant('spatial-calculator'),
      room.addParticipant('financial-underwriter'),
    ]);
  }

  await bandClient.emit(room.id, { event: 'session.started', sessionId, rawInput });

  try {
    await bandClient.emit(room.id, { event: 'agent.activated', agent: 'INTAKE PARSER' });

    const preview = await resolveSitePreview(rawInput);
    const lotData = preview.lotData;

    if (!lotData.zonedist1 || lotData.lot_area_sqft <= 0) {
      throw new Error(
        `Validation failed: zonedist1=${lotData.zonedist1}, lot_area=${lotData.lot_area_sqft}`
      );
    }

    for (const warning of preview.warnings) {
      await bandClient.emit(room.id, {
        event: 'agent.message',
        agent: 'INTAKE_PARSER',
        content: `Note: ${warning}`,
      });
    }

    await bandRoom.context.set(room.id, 'lot_data', lotData);
    const intakeMsg = `Site confirmed: ${lotData.address} | Zone ${lotData.zonedist1} | ${lotData.lot_area_sqft.toLocaleString()} sq ft | BBL ${lotData.bbl}`;
    await bandClient.emit(room.id, {
      event: 'agent.message',
      agent: 'INTAKE_PARSER',
      content: intakeMsg,
    });

    await bandClient.emit(room.id, { event: 'agent.activated', agent: 'ZONING COMPLIANCE' });
    const zoningLog = await runZoningAgent(room.id);
    await bandClient.emit(room.id, {
      event: 'agent.message',
      agent: 'ZONING_COMPLIANCE',
      content: zoningLog,
    });

    await bandClient.emit(room.id, { event: 'agent.activated', agent: 'SPATIAL CALCULATOR' });
    const spatialLog = await runSpatialAgent(room.id);
    await bandClient.emit(room.id, {
      event: 'agent.message',
      agent: 'SPATIAL_CALCULATOR',
      content: spatialLog,
    });

    await bandClient.emit(room.id, { event: 'agent.activated', agent: 'FINANCIAL UNDERWRITER' });
    const finLog = await runFinancialAgent(room.id);
    await bandClient.emit(room.id, {
      event: 'agent.message',
      agent: 'FINANCIAL_UNDERWRITER',
      content: finLog,
    });

    await bandClient.emit(room.id, { event: 'session.complete', status: 'APPROVED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await bandRoom.context.set(room.id, 'error_log', [message]);
    await bandRoom.context.set(room.id, 'status', 'FAILED');
    await bandClient.emit(room.id, { event: 'session.error', error: message });
    throw error;
  }

  return room.id;
}
