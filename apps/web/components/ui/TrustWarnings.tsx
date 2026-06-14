'use client';

import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;
type ZoningData = NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;
type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;

interface TrustWarningsProps {
  financialData: FinancialData | null;
  zoningData: ZoningData | null;
  lotData: LotData | null;
}

export default function TrustWarnings({ financialData, zoningData, lotData }: TrustWarningsProps) {
  const warnings: string[] = [];

  if (financialData?.comp_default_used || financialData?.comp_count === 0) {
    warnings.push(
      `No recent sales comps found — GDV uses a default $${financialData?.comp_avg_psf ?? 850}/sf assumption. Treat verdict as directional only.`
    );
  } else if (financialData && financialData.comp_count < 3) {
    warnings.push(
      `Only ${financialData.comp_count} comp(s) found — PSF estimate may be thin.`
    );
  }

  if (zoningData?.zoning_approximated) {
    warnings.push(
      `Zone ${lotData?.zonedist1 ?? ''} mapped to simplified table entry “${zoningData.zoning_table_key}” — confirm with a licensed architect.`
    );
  }

  if (lotData?.geocode_confidence !== undefined && lotData.geocode_confidence < 0.8) {
    warnings.push(
      `Geocoder matched “${lotData.geocode_label}” at ${(lotData.geocode_confidence * 100).toFixed(0)}% confidence — verify BBL ${lotData.bbl}.`
    );
  }

  if (financialData?.assessed_land_estimate) {
    warnings.push(
      `Land ask estimate uses assessed land ($${financialData.assessed_land_estimate.toLocaleString()}) × ${financialData.assessed_land_multiplier ?? 10} — not a market appraisal.`
    );
  }

  if (financialData?.hard_cost_psf) {
    warnings.push(
      `Hard costs modeled at $${financialData.hard_cost_psf}/sf citywide — adjust for borough, product type, and construction market.`
    );
  }

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#c8956c]/40 bg-[#fff8e1]/80 px-3 py-2.5 space-y-1.5">
      <p className="type-label text-[9px] text-[#8b5a2b]">Assumptions &amp; data quality</p>
      {warnings.map((w, i) => (
        <p key={i} className="text-xs text-[#5c4033] leading-snug flex gap-1.5">
          <span aria-hidden className="shrink-0">⚠</span>
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
}
