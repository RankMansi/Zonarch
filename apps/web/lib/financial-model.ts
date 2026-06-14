import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import { calcCompStats, fetchNeighborhoodComps } from './tools/sales-api';

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;
type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;
type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;

export interface FinancialInputs {
  compPsf?: number;
  compCount?: number;
  hardCostPsf?: number;
  landAsk?: number;
  assessedLandMultiplier?: number;
  capRate?: number;
  irrEstimate?: number;
}

const DEFAULT_HARD_COST = 375;
const DEFAULT_ASSESSED_MULT = 10;

export function computeFinancial(
  lotData: LotData,
  envelope: EnvelopeData,
  inputs: FinancialInputs = {},
  comps?: Awaited<ReturnType<typeof fetchNeighborhoodComps>>
): FinancialData {
  const grossSqft = envelope.max_residential_sqft;
  const netSqft = grossSqft * 0.85;
  const hardCostPsf = inputs.hardCostPsf ?? DEFAULT_HARD_COST;
  const assessedMult = inputs.assessedLandMultiplier ?? DEFAULT_ASSESSED_MULT;

  let compPsf = inputs.compPsf;
  let compCount = inputs.compCount ?? 0;
  let compDefaultUsed = false;
  let compAddresses: string[] = [];

  if (compPsf === undefined && comps) {
    const stats = calcCompStats(comps);
    compPsf = stats.avgPSF;
    compCount = stats.count;
    compDefaultUsed = stats.count === 0;
    compAddresses = comps.slice(0, 5).map((c) => c.address);
  } else if (compPsf === undefined) {
    compPsf = 850;
    compDefaultUsed = true;
  } else if (compCount === 0 && compPsf === 850) {
    compDefaultUsed = true;
  }

  const projectedAssetValue = netSqft * compPsf;
  const hardCostTotal = grossSqft * hardCostPsf;
  const softCostTotal = hardCostTotal * 0.22;
  const financingCost = (hardCostTotal + softCostTotal) * 0.06;
  const developerProfit = projectedAssetValue * 0.18;
  const totalProjectCost = hardCostTotal + softCostTotal + financingCost + developerProfit;
  const residualLandValue = projectedAssetValue - totalProjectCost;

  const assessedLandEstimate = inputs.landAsk ?? lotData.assessland * assessedMult;
  const assessedLand = assessedLandEstimate;

  let verdict: FinancialData['deal_verdict'];
  let rationale: string;

  if (residualLandValue > assessedLand * 1.5) {
    verdict = 'STRONG BUY';
    rationale = `RLV $${(residualLandValue / 1e6).toFixed(1)}M exceeds land ask by >50%.`;
  } else if (residualLandValue > assessedLand * 1.1) {
    verdict = 'BUY';
    rationale = `RLV $${(residualLandValue / 1e6).toFixed(1)}M exceeds land ask — viable deal.`;
  } else if (residualLandValue > 0) {
    verdict = 'HOLD';
    rationale = 'Positive RLV but thin margin — negotiate land price or raise exit PSF.';
  } else {
    verdict = 'PASS';
    rationale = `Negative RLV $${(residualLandValue / 1e6).toFixed(1)}M at these assumptions.`;
  }

  const capRate = inputs.capRate ?? 0.045;
  const irrEstimate = inputs.irrEstimate ?? 0.18;

  return {
    comp_avg_psf: compPsf,
    comp_count: compCount,
    comp_addresses: compAddresses,
    projected_asset_value: projectedAssetValue,
    hard_cost_psf: hardCostPsf,
    hard_cost_total: hardCostTotal,
    soft_cost_total: softCostTotal,
    financing_cost: financingCost,
    developer_profit: developerProfit,
    total_project_cost: totalProjectCost,
    residual_land_value: residualLandValue,
    cap_rate: capRate,
    irr_estimate: irrEstimate,
    deal_verdict: verdict,
    verdict_rationale: rationale,
    comp_default_used: compDefaultUsed,
    assessed_land_estimate: lotData.assessland,
    assessed_land_multiplier: assessedMult,
  };
}

/** PSF needed for BUY verdict at current land ask estimate. */
export function psfNeededForBuy(
  lotData: LotData,
  envelope: EnvelopeData,
  landAsk?: number
): number {
  const grossSqft = envelope.max_residential_sqft;
  const netSqft = grossSqft * 0.85;
  const hardCostTotal = grossSqft * DEFAULT_HARD_COST;
  const softCostTotal = hardCostTotal * 0.22;
  const financingCost = (hardCostTotal + softCostTotal) * 0.06;
  const fixedCosts = hardCostTotal + softCostTotal + financingCost;
  const assessedLand = landAsk ?? lotData.assessland * DEFAULT_ASSESSED_MULT;
  const targetRlv = assessedLand * 1.11;
  // GDV - 0.18*GDV - fixedCosts = targetRlv  => GDV = (targetRlv + fixedCosts) / 0.82
  const targetGdv = (targetRlv + fixedCosts) / 0.82;
  return targetGdv / netSqft;
}

export function parseScenarioQuestion(
  question: string,
  lotData: LotData,
  envelope: EnvelopeData,
  current?: FinancialData
): { inputs: FinancialInputs; answer: string } {
  const q = question.toLowerCase();
  const inputs: FinancialInputs = {
    compPsf: current?.comp_avg_psf,
    compCount: current?.comp_count,
    hardCostPsf: current?.hard_cost_psf,
  };

  const landMatch = q.match(/land (?:is|at|price|ask)?\s*\$?\s*([\d.]+)\s*(m|million|k)?/i);
  if (landMatch) {
    let val = parseFloat(landMatch[1]);
    const unit = landMatch[2]?.toLowerCase();
    if (unit === 'm' || unit === 'million') val *= 1e6;
    else if (unit === 'k') val *= 1e3;
    else if (val < 1000) val *= 1e6;
    inputs.landAsk = val;
    return {
      inputs,
      answer: `Re-running with land ask $${(val / 1e6).toFixed(2)}M instead of assessed estimate.`,
    };
  }

  const psfMatch = q.match(/(?:psf|price per (?:sq|square) ft)\s*(?:of|at|is|=)?\s*\$?\s*([\d,]+)/i);
  if (psfMatch) {
    inputs.compPsf = parseFloat(psfMatch[1].replace(/,/g, ''));
    inputs.compCount = 1;
    return {
      inputs,
      answer: `Re-running with exit PSF $${inputs.compPsf}/sf.`,
    };
  }

  if (q.includes('psf') && (q.includes('buy') || q.includes('need'))) {
    const needed = psfNeededForBuy(lotData, envelope, current?.assessed_land_estimate
      ? current.assessed_land_estimate * (current.assessed_land_multiplier ?? DEFAULT_ASSESSED_MULT)
      : undefined);
    inputs.compPsf = needed;
    inputs.compCount = 0;
    return {
      inputs,
      answer: `You need ~$${Math.round(needed)}/sf exit PSF to reach BUY at current land ask.`,
    };
  }

  const costMatch = q.match(/hard cost\s*\$?\s*([\d]+)/i);
  if (costMatch) {
    inputs.hardCostPsf = parseFloat(costMatch[1]);
    return { inputs, answer: `Re-running with hard cost $${inputs.hardCostPsf}/sf.` };
  }

  return {
    inputs,
    answer: 'Adjusted financial model with your current assumptions.',
  };
}

export async function rerunFinancial(
  lotData: LotData,
  envelope: EnvelopeData,
  inputs: FinancialInputs
): Promise<FinancialData> {
  const comps = inputs.compPsf
    ? undefined
    : await fetchNeighborhoodComps(lotData.borough, lotData.neighborhood || '');
  return computeFinancial(lotData, envelope, inputs, comps);
}
