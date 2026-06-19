'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import LeftPanel from '@/components/panels/LeftPanel';
import CenterPanel from '@/components/panels/CenterPanel';
import RightPanel from '@/components/panels/RightPanel';
import BentoCard from '@/components/ui/BentoCard';
import TerminalGlassNav from '@/components/ui/TerminalGlassNav';
import StickyDecisionBar from '@/components/ui/StickyDecisionBar';
import type { SessionStatus } from '@/types/zone-draft';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import type { SitePreview } from '@/lib/resolve-site';
import { fetchApiJson } from '@/lib/http-json';

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;
type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;
type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;
type ZoningData = NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;

function previewFromLot(lot: LotData, rawInput: string): SitePreview {
  return {
    rawInput,
    inputKind: lot.input_kind ?? 'address',
    geo: {
      label: lot.geocode_label || lot.address,
      borough: lot.borough,
      bbl: lot.bbl,
      latitude: lot.latitude,
      longitude: lot.longitude,
      confidence: lot.geocode_confidence ?? 1,
      streetAddress: lot.address,
    },
    lotData: lot,
    warnings: [],
  };
}

export default function UnderwriteWorkbench() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoredRef = useRef<string | null>(null);

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
  const [isRestoring, setIsRestoring] = useState(false);

  const syncSessionUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set('session', id);
      else params.delete('session');
      const qs = params.toString();
      router.replace(qs ? `/underwrite?${qs}` : '/underwrite', { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const fromUrl = searchParams.get('session');
    if (!fromUrl || restoredRef.current === fromUrl) return;

    let cancelled = false;
    setIsRestoring(true);

    fetch(`/api/session/${fromUrl}/snapshot`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Session not found');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        restoredRef.current = fromUrl;
        setSessionId(data.sessionId);
        setPendingInput(data.rawInput);
        setStatus(data.status as SessionStatus);
        setIsRunning(data.status === 'running');

        const schema = data.schema;
        if (schema?.lot_data) {
          setLotData(schema.lot_data);
          setPreview(previewFromLot(schema.lot_data, data.rawInput));
        }
        if (schema?.zoning_analysis) setZoningData(schema.zoning_analysis);
        if (schema?.building_envelope) setEnvelopeData(schema.building_envelope);
        if (schema?.financial_analysis) setFinancialData(schema.financial_analysis);
      })
      .catch(() => {
        if (!cancelled) syncSessionUrl(null);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, syncSessionUrl]);

  const handleLookup = async (rawInput: string) => {
    setIsLookingUp(true);
    setPreviewError(null);
    setPreview(null);
    setPendingInput(rawInput);
    try {
      const { response: res, data } = await fetchApiJson<SitePreview & { error?: string }>(
        '/api/preview',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawInput }),
        }
      );
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
    const { response: res, data } = await fetchApiJson<{ sessionId?: string; error?: string }>(
      '/api/underwrite',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: pendingInput }),
      }
    );
    if (data.sessionId) {
      setSessionId(data.sessionId);
      restoredRef.current = data.sessionId;
      syncSessionUrl(data.sessionId);
    } else {
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

  const canOpenSiteViewer =
    Boolean(sessionId) && status === 'complete' && lotData && envelopeData;

  return (
    <div className="terminal-bento-page underwrite-page">
      <TerminalGlassNav status={status} />

      <div className="underwrite-shell">
        {isRestoring && (
          <p className="text-xs text-[#6b4423]">Restoring session…</p>
        )}

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
                  onFinancialUpdate={setFinancialData}
                />
              </div>
            </BentoCard>
          </div>

          <BentoCard step={2} title="Parcel" className="underwrite-parcel-mobile">
            <LeftPanel {...leftProps} section="pluto" />
          </BentoCard>
        </div>

        {canOpenSiteViewer ? (
          <Link
            href={`/site-viewer/${sessionId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#6b4423] hover:bg-[#5a381d] px-4 py-2.5 rounded-xl self-start transition-colors"
          >
            View site in 3D →
          </Link>
        ) : (
          <p className="text-xs text-[#8b5a2b] self-start">
            {status === 'running'
              ? '3D site viewer unlocks when analysis completes.'
              : 'Look up a site and run analysis to open the 3D site viewer.'}
          </p>
        )}
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
