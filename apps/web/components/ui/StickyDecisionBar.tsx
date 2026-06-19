'use client';

import type { SessionStatus } from '@/types/zone-draft';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import EmailBriefButton from '@/components/ui/EmailBriefButton';

type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;
type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;

interface StickyDecisionBarProps {
  lotData: LotData | null;
  financialData: FinancialData | null;
  status: SessionStatus;
  sessionId: string | null;
  onExport?: () => void;
}

export default function StickyDecisionBar({
  lotData,
  financialData,
  status,
  sessionId,
  onExport,
}: StickyDecisionBarProps) {
  const address = lotData?.address?.split(',')[0] ?? 'No site yet';
  const verdict = financialData?.deal_verdict ?? '—';
  const rlv = financialData
    ? `$${(financialData.residual_land_value / 1e6).toFixed(1)}M`
    : '—';

  return (
    <div className="sticky-decision-bar">
      <div className="sticky-decision-inner flex-wrap gap-y-2">
        <span className="truncate max-w-[140px] sm:max-w-[200px] text-xs text-[#5c4033]">{address}</span>
        <span className="hidden sm:inline text-[#d4c4b0">|</span>
        <span className="text-xs font-bold text-[#2c1810]">{verdict}</span>
        <span className="hidden sm:inline text-[#d4c4b0">|</span>
        <span className="text-xs text-[#6b4423]">
          Land value: <strong>{rlv}</strong>
        </span>
        {status === 'complete' && sessionId && onExport && (
          <>
            <button
              type="button"
              onClick={onExport}
              className="text-[10px] px-3 py-1 rounded-full bg-[#6b4423] text-white shrink-0"
            >
              Export
            </button>
            <EmailBriefButton sessionId={sessionId} />
          </>
        )}
      </div>
    </div>
  );
}
