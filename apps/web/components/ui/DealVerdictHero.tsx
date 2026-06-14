'use client';

import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;

function verdictStyles(verdict?: string) {
  if (!verdict) {
    return {
      bg: 'bg-[#ede4d9]',
      border: 'border-[#d4c4b0]',
      text: 'text-[#6b4423]',
    };
  }
  if (verdict.includes('BUY')) {
    return {
      bg: 'bg-[#e8f5e9]',
      border: 'border-[#7cb342]',
      text: 'text-[#2e7d32]',
    };
  }
  if (verdict === 'HOLD') {
    return {
      bg: 'bg-[#fff8e1]',
      border: 'border-[#c8956c]',
      text: 'text-[#8b5a2b]',
    };
  }
  return {
    bg: 'bg-[#ffebee]',
    border: 'border-[#c62828]',
    text: 'text-[#c62828]',
  };
}

interface DealVerdictHeroProps {
  financialData: FinancialData | null;
  pipelineComplete: boolean;
}

export default function DealVerdictHero({ financialData, pipelineComplete }: DealVerdictHeroProps) {
  if (!financialData) {
    return (
      <div className="rounded-xl border border-dashed border-[#d4c4b0] bg-white/60 px-4 py-5 text-center">
        <p className="text-sm text-[#6b4423]">
          Enter a site and run analysis to see your deal verdict (BUY / HOLD / PASS).
        </p>
        <p className="text-xs text-[#8b5a2b] mt-1">
          This is a modeled recommendation — not investment advice.
        </p>
      </div>
    );
  }

  const styles = verdictStyles(financialData.deal_verdict);

  return (
    <div className={`rounded-xl border-2 px-4 py-4 ${styles.bg} ${styles.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-label text-[9px] text-[#6b4423] mb-1">Deal recommendation</p>
          <p className={`text-2xl md:text-3xl font-bold tracking-tight ${styles.text}`} style={{ fontFamily: 'var(--font-syne)' }}>
            {financialData.deal_verdict}
          </p>
          <p className="text-sm text-[#2c1810] mt-2 max-w-md leading-relaxed">
            {financialData.verdict_rationale}
          </p>
        </div>
        {pipelineComplete && (
          <span className="type-label text-[9px] px-2.5 py-1 rounded-full bg-white/80 border border-[#d4c4b0] text-[#6b4423] shrink-0">
            Analysis complete
          </span>
        )}
      </div>
      <p className="text-[10px] text-[#8b5a2b] mt-3 border-t border-[#d4c4b0]/50 pt-2">
        “Analysis complete” means all agents finished — it is not the same as BUY. Review assumptions below before acting.
      </p>
    </div>
  );
}
