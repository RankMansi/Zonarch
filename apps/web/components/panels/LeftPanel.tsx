'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import type { SitePreview } from '@/lib/resolve-site';

const LotMap = dynamic(() => import('@/components/map/LotMap'), {
  ssr: false,
  loading: () => (
    <div className="lot-map-shell bg-[#ede4d9] flex items-center justify-center" style={{ height: 200 }}>
      <span className="text-xs text-[#6b4423]">Loading map…</span>
    </div>
  ),
});

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;

export const SAMPLE_SITES = [
  { label: 'Court Square', value: '45-18 Court Square, Long Island City, Queens, NY 11101' },
  { label: 'Bedford Ave', value: '123 Bedford Ave, Brooklyn, NY 11211' },
  { label: 'BBL', value: '4001420045' },
] as const;

interface LeftPanelProps {
  onLookup: (rawInput: string) => void;
  onConfirmRun: () => void;
  isRunning: boolean;
  isLookingUp: boolean;
  lotData: LotData | null;
  preview: SitePreview | null;
  previewError: string | null;
  section: 'input' | 'map' | 'pluto';
  mapHeight?: number;
}

export default function LeftPanel({
  onLookup,
  onConfirmRun,
  isRunning,
  isLookingUp,
  lotData,
  preview,
  previewError,
  section,
  mapHeight = 200,
}: LeftPanelProps) {
  const [input, setInput] = useState<string>(SAMPLE_SITES[0].value);

  const handleLookup = () => {
    if (!input.trim() || isRunning || isLookingUp) return;
    onLookup(input.trim());
  };

  if (section === 'input') {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_SITES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              disabled={isRunning || isLookingUp}
              onClick={() => setInput(sample.value)}
              className="text-[10px] px-2 py-1 rounded-full border border-[#d4c4b0] bg-white text-[#6b4423] hover:border-[#8b5a2b] disabled:opacity-50"
            >
              {sample.label}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Address or 10-digit BBL"
          className="w-full min-h-[72px] max-h-[100px] bg-white border-2 border-[#d4c4b0] text-[#2c1810] font-mono text-sm p-3 rounded-xl resize-none focus:outline-none focus:border-[#8b5a2b]"
          disabled={isRunning}
        />

        <button
          type="button"
          onClick={handleLookup}
          disabled={isRunning || isLookingUp}
          className="w-full py-2.5 rounded-xl text-xs font-bold bg-white border-2 border-[#6b4423] text-[#6b4423] hover:bg-[#f5ebe0] disabled:opacity-50"
        >
          {isLookingUp ? 'Looking up…' : 'Look up site'}
        </button>

        {previewError && (
          <p className="text-xs text-[#c62828] bg-[#ffebee] rounded-lg px-2 py-1.5">{previewError}</p>
        )}

        {preview && !isRunning && (
          <div className="rounded-xl border border-[#8b5a2b]/40 bg-[#f5ebe0] px-3 py-2.5 space-y-2">
            <p className="font-mono text-xs text-[#2c1810]">{preview.lotData.address}</p>
            <p className="text-[10px] text-[#5c4033]">
              BBL {preview.lotData.bbl} · {preview.lotData.zonedist1} ·{' '}
              {preview.lotData.lot_area_sqft.toLocaleString()} sq ft
            </p>
            {preview.warnings.map((w) => (
              <p key={w} className="text-[10px] text-[#8b5a2b]">⚠ {w}</p>
            ))}
            <button
              type="button"
              onClick={onConfirmRun}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#6b4423] text-[#f5ebe0]"
            >
              Run analysis
            </button>
          </div>
        )}
      </div>
    );
  }

  if (section === 'map') {
    return <LotMap lotData={lotData} light height={mapHeight} />;
  }

  if (section === 'pluto') {
    if (!lotData) {
      return <p className="text-xs text-[#6b4423]/70">Parcel data after site lookup.</p>;
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'BBL', value: lotData.bbl },
          { label: 'Zone', value: lotData.zonedist1 },
          { label: 'Lot size', value: `${lotData.lot_area_sqft.toLocaleString()} sf` },
          { label: 'Built', value: lotData.yearbuilt || '—' },
        ].map((chip) => (
          <div key={chip.label} className="bg-white rounded-lg px-2 py-2 border border-[#d4c4b0]/50">
            <p className="text-[9px] uppercase tracking-wide text-[#8b5a2b]">{chip.label}</p>
            <p className="font-mono text-xs font-semibold text-[#2c1810] truncate">{chip.value}</p>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
