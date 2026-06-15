'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { SiteViewerPayload } from '@/types/zone-draft';
import SiteViewerHeader from './SiteViewerHeader';
import SiteViewerFooter from './SiteViewerFooter';
import LayerPanel, {
  DEFAULT_LAYER_VISIBILITY,
  type LayerToggleKey,
  type LayerVisibility,
} from './LayerPanel';

const SiteViewerMap = dynamic(() => import('./SiteViewerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#e8e0d4] animate-pulse flex items-center justify-center text-[#8b5a2b] text-sm">
      Loading 3D map…
    </div>
  ),
});

interface SiteViewerClientProps {
  sessionId: string;
}

export default function SiteViewerClient({ sessionId }: SiteViewerClientProps) {
  const [payload, setPayload] = useState<SiteViewerPayload | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/site-viewer/${sessionId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw { status: res.status, message: data.error || res.statusText };
        }
        return data as SiteViewerPayload;
      })
      .then((data) => {
        if (!cancelled) {
          setPayload(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const onLayerChange = useCallback((key: LayerToggleKey, value: boolean) => {
    setVisibility((v) => ({ ...v, [key]: value }));
  }, []);

  if (loading) {
    return (
      <div className="site-viewer-shell h-dvh flex flex-col bg-[#e8e0d4]">
        <div className="h-12 bg-[#d4c4b0]/40 animate-pulse" />
        <div className="flex-1 animate-pulse bg-[#ede4d9]" />
        <div className="h-14 bg-[#d4c4b0]/40 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="site-viewer-shell h-dvh flex flex-col items-center justify-center bg-[#e8e0d4] p-6 text-center">
        <h1 className="text-lg font-semibold text-[#2c1810] mb-2">
          {error.status === 404 ? 'Session not found' : 'Site viewer unavailable'}
        </h1>
        <p className="text-sm text-[#6b4423] mb-4 max-w-md">{error.message}</p>
        {error.status === 422 ? (
          <Link
            href="/underwrite"
            className="text-sm font-semibold text-white bg-[#6b4423] px-4 py-2 rounded-lg"
          >
            Run underwriting first →
          </Link>
        ) : (
          <Link href="/underwrite" className="text-sm text-[#6b4423] underline">
            ← Back to underwrite
          </Link>
        )}
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="site-viewer-shell h-dvh flex flex-col bg-[#e8e0d4] overflow-hidden">
      <SiteViewerHeader
        address={payload.address}
        bbl={payload.bbl}
        zonedist1={payload.zonedist1}
      />

      {payload.meta.data_warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-100/90 border-b border-amber-300/60 text-xs text-amber-950 shrink-0">
          {payload.meta.data_warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <SiteViewerMap payload={payload} visibility={visibility} />
        <LayerPanel visibility={visibility} onChange={onLayerChange} />
      </div>

      <SiteViewerFooter
        heightFt={payload.metrics.height_ft}
        floors={payload.metrics.floors}
        gfaSqft={payload.metrics.gfa_sqft}
        verdict={payload.metrics.verdict}
      />
    </div>
  );
}
