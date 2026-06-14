'use client';

import dynamic from 'next/dynamic';
import type { SessionStatus } from '@/types/zone-draft';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import DealVerdictHero from '@/components/ui/DealVerdictHero';
import TrustWarnings from '@/components/ui/TrustWarnings';
import MetricLabel from '@/components/ui/MetricLabel';
import ExportPreview from '@/components/ui/ExportPreview';
import ChallengePanel from '@/components/ui/ChallengePanel';
import ZoningCitations from '@/components/ui/ZoningCitations';
import LenderQuestions from '@/components/ui/LenderQuestions';
import GlossaryDrawer from '@/components/ui/GlossaryDrawer';

const BuildingScene = dynamic(
  () => import('@/components/three/BuildingScene').then((m) => m.BuildingScene),
  { ssr: false, loading: () => <div className="h-full bg-[#ede4d9] animate-pulse rounded-xl" /> }
);

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;
type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;
type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;
type ZoningData = NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;

interface RightPanelProps {
  envelopeData: EnvelopeData | null;
  lotData: LotData | null;
  financialData: FinancialData | null;
  zoningData: ZoningData | null;
  status: SessionStatus;
  sessionId: string | null;
  section?: 'envelope' | 'metrics';
  onFinancialUpdate?: (data: FinancialData) => void;
  showAdvanced?: boolean;
}

export default function RightPanel({
  envelopeData,
  lotData,
  financialData,
  zoningData,
  status,
  sessionId,
  section = 'envelope',
  onFinancialUpdate,
  showAdvanced = true,
}: RightPanelProps) {
  const far = zoningData?.uap_far ?? zoningData?.base_far ?? '—';
  const floors = envelopeData?.floors_with_uap ?? '—';
  const height = envelopeData?.total_height_ft?.toFixed(0) ?? '—';
  const gfa = envelopeData?.gross_floor_area?.toLocaleString() ?? '—';
  const rlv = financialData
    ? `$${(financialData.residual_land_value / 1e6).toFixed(1)}M`
    : '—';
  const gdv = financialData
    ? `$${(financialData.projected_asset_value / 1e6).toFixed(1)}M`
    : '—';

  if (section === 'metrics') {
    return (
      <div className="space-y-3">
        <GlossaryDrawer />
        <DealVerdictHero financialData={financialData} pipelineComplete={status === 'complete'} />
        <TrustWarnings financialData={financialData} zoningData={zoningData} lotData={lotData} />

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Max FAR', value: far },
            { label: 'Floors', value: floors },
            { label: 'Height', value: `${height} ft` },
            { label: 'GFA', value: gfa },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl px-3 py-2.5 border border-[#d4c4b0]/50">
              <p className="type-label text-[#8b5a2b] text-[9px]">
                <MetricLabel label={m.label} />
              </p>
              <p className="font-mono text-base font-bold text-[#2c1810] mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl px-3 py-2.5 border border-[#d4c4b0]/50">
            <p className="type-label text-[#8b5a2b] text-[9px]">
              <MetricLabel label="RLV" />
            </p>
            <p className="font-mono text-lg font-bold text-[#6b4423]">{rlv}</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 border border-[#d4c4b0]/50">
            <p className="type-label text-[#8b5a2b] text-[9px]">
              <MetricLabel label="GDV" />
            </p>
            <p className="font-mono text-lg font-bold text-[#6b4423]">{gdv}</p>
          </div>
        </div>

        {showAdvanced && financialData && (
          <>
            <ChallengePanel
              sessionId={sessionId}
              financialData={financialData}
              onUpdate={onFinancialUpdate ?? (() => {})}
              disabled={status !== 'complete' && status !== 'running'}
            />
            <ZoningCitations zoningData={zoningData} lotData={lotData} />
            <LenderQuestions financialData={financialData} zoningData={zoningData} />
          </>
        )}

        <ExportPreview sessionId={sessionId} ready={status === 'complete'} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-[120px] rounded-xl overflow-hidden border border-[#d4c4b0]/60 bg-[#e8e0d4]">
        <BuildingScene envelopeData={envelopeData} lotData={lotData} status={status} light />
      </div>
    </div>
  );
}
