'use client';

import { useState, useCallback } from 'react';
import LeftPanel from '@/components/panels/LeftPanel';
import CenterPanel from '@/components/panels/CenterPanel';
import RightPanel from '@/components/panels/RightPanel';
import BentoCard from '@/components/ui/BentoCard';
import TerminalGlassNav from '@/components/ui/TerminalGlassNav';
import StickyDecisionBar from '@/components/ui/StickyDecisionBar';
import type { SessionStatus } from '@/types/zone-draft';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import type { SitePreview } from '@/lib/resolve-site';

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;
type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;
type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;
type ZoningData = NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;

export default function UnderwritePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingInput, setPendingInput] = useState<string | null>(null);
  const [preview, setPreview] = useState<SitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lotData, setLotData] = useState<LotData | null>(null);
  const [envelopeData, setEnvelopeData] = useState<EnvelopeData | null>(null);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [zoningData, setZoningData] = useState<ZoningData | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleLookup = async (rawInput: string) => {
    setIsLookingUp(true);
    setPreviewError(null);
    setPreview(null);
    setPendingInput(rawInput);
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setPreview(data);
      setLotData(data.lotData);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleConfirmRun = async () => {
    if (!pendingInput) return;
    setIsRunning(true);
    setStatus('running');
    setErrorMessage(null);
    setEnvelopeData(null);
    setFinancialData(null);
    setZoningData(null);
    const res = await fetch('/api/underwrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: pendingInput }),
    });
    const data = await res.json();
    if (data.sessionId) setSessionId(data.sessionId);
    else {
      setIsRunning(false);
      setStatus('failed');
      setErrorMessage(data.error || 'Failed to start');
    }
  };

  const onStatusChange = useCallback((s: SessionStatus) => {
    setStatus(s);
    if (s === 'complete' || s === 'failed') setIsRunning(false);
  }, []);

  const onStreamError = useCallback((msg: string) => setErrorMessage(msg), []);

  const leftProps = {
    onLookup: handleLookup,
    onConfirmRun: handleConfirmRun,
    isRunning,
    isLookingUp,
    lotData,
    preview,
    previewError,
  };

  const handleExport = () => {
    if (!sessionId) return;
    fetch(`/api/export/${sessionId}`)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zone-draft-${sessionId.slice(0, 8)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="terminal-bento-page underwrite-page">
      <TerminalGlassNav status={status} />

      <div className="underwrite-shell">
        {errorMessage && (
          <div className="underwrite-error rounded-lg border border-[#c62828]/30 bg-[#ffebee] px-3 py-2 text-xs text-[#b71c1c]">
            {errorMessage}
          </div>
        )}

        {status === 'running' && stepLabel && (
          <p className="text-xs text-[#6b4423]">Running: {stepLabel}</p>
        )}

        <div className="underwrite-main">
          <div className="underwrite-col-input">
            <BentoCard step={1} title="Site" accent fill>
              <LeftPanel {...leftProps} section="input" />
            </BentoCard>
            <BentoCard step={2} title="Parcel" className="underwrite-parcel-card underwrite-parcel-desktop">
              <LeftPanel {...leftProps} section="pluto" />
            </BentoCard>
          </div>

          <div className="underwrite-col-stream">
            <BentoCard step={3} title="Progress" fill className="h-full">
              <CenterPanel
                sessionId={sessionId}
                envelopeData={envelopeData}
                onLotData={setLotData}
                onEnvelopeData={setEnvelopeData}
                onFinancialData={setFinancialData}
                onZoningData={setZoningData}
                onStatusChange={onStatusChange}
                onStepLabel={setStepLabel}
                onError={onStreamError}
              />
            </BentoCard>
          </div>

          <div className="underwrite-col-verdict">
            <BentoCard step={4} title="Recommendation" fill>
              <div className="overflow-y-auto min-h-0 flex-1">
                <RightPanel
                  envelopeData={envelopeData}
                  lotData={lotData}
                  financialData={financialData}
                  zoningData={zoningData}
                  status={status}
                  sessionId={sessionId}
                  section="metrics"
                  showAdvanced={showAdvanced}
                  onFinancialUpdate={setFinancialData}
                />
              </div>
            </BentoCard>
          </div>

          <BentoCard step={2} title="Parcel" className="underwrite-parcel-mobile">
            <LeftPanel {...leftProps} section="pluto" />
          </BentoCard>
        </div>

        {showAdvanced && (
          <div className="underwrite-viz">
            <BentoCard title="Lot map" className="underwrite-viz-map">
              <LeftPanel {...leftProps} section="map" mapHeight={220} />
            </BentoCard>
            <BentoCard title="Building model">
              <RightPanel
                envelopeData={envelopeData}
                lotData={lotData}
                financialData={financialData}
                zoningData={zoningData}
                status={status}
                sessionId={sessionId}
                section="envelope"
              />
            </BentoCard>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-[#6b4423] underline underline-offset-2 self-start"
        >
          {showAdvanced ? 'Simple view' : 'Show map, 3D model & details'}
        </button>
      </div>

      <StickyDecisionBar
        lotData={lotData}
        financialData={financialData}
        status={status}
        sessionId={sessionId}
        onExport={handleExport}
      />
    </div>
  );
}
