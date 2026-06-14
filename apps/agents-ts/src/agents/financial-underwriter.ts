import { createTool, Agent } from '@mastra/core';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { fetchNeighborhoodComps, calcCompStats } from '../tools/sales-api';
import { bandRoom } from '../band/room';

const runResidualLandValueModel = createTool({
  id: 'run_rlv_model',
  description: 'Calculates Residual Land Value from Band room context',
  inputSchema: z.object({ roomId: z.string() }),
  execute: async ({ roomId }) => {
    const lotData = await bandRoom.context.get(roomId, 'lot_data');
    const envelope = await bandRoom.context.get(roomId, 'building_envelope');
    if (!lotData || !envelope) throw new Error('RLV: Missing lot_data or building_envelope');

    const comps = await fetchNeighborhoodComps(lotData.borough, lotData.neighborhood || '');
    const compStats = calcCompStats(comps);
    const grossSqft = envelope.max_residential_sqft;
    const netSqft = grossSqft * 0.85;
    const HARD_COST_PSF = 375;

    const projectedAssetValue = netSqft * compStats.avgPSF;
    const hardCostTotal = grossSqft * HARD_COST_PSF;
    const softCostTotal = hardCostTotal * 0.22;
    const financingCost = (hardCostTotal + softCostTotal) * 0.06;
    const developerProfit = projectedAssetValue * 0.18;
    const totalProjectCost = hardCostTotal + softCostTotal + financingCost + developerProfit;
    const residualLandValue = projectedAssetValue - totalProjectCost;

    const financial = {
      comp_avg_psf: compStats.avgPSF,
      comp_count: compStats.count,
      comp_addresses: comps.slice(0, 5).map((c: { address: string }) => c.address),
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
      deal_verdict: residualLandValue > 0 ? 'BUY' : 'PASS',
      verdict_rationale: `RLV $${(residualLandValue / 1e6).toFixed(1)}M`,
    };

    await bandRoom.context.set(roomId, 'financial_analysis', financial);
    await bandRoom.context.set(roomId, 'status', 'APPROVED');
    return financial;
  },
});

export const financialUnderwriter = new Agent({
  name: 'Financial Underwriter',
  instructions: 'Run RLV model when building_envelope is ready.',
  model: google('gemini-1.5-flash'),
  tools: { runResidualLandValueModel },
});
