'use client';

import { useState } from 'react';
import ExportButton from './ExportButton';

interface ExportPreviewProps {
  sessionId: string | null;
  ready: boolean;
}

export default function ExportPreview({ sessionId, ready }: ExportPreviewProps) {
  const downloadMemo = () => {
    if (!sessionId) return;
    window.open(`/api/memo/${sessionId}`, '_blank');
  };

  return (
    <div className="rounded-xl border border-[#d4c4b0]/50 bg-white px-3 py-3 space-y-2">
      <p className="text-xs font-semibold text-[#2c1810]">Downloads</p>
      <ul className="text-[10px] text-[#5c4033] space-y-0.5 list-disc pl-4">
        <li>Audit ZIP — report, CSV, geometry</li>
        <li>IC memo — one-page summary for partners</li>
      </ul>
      {ready && sessionId ? (
        <div className="flex flex-col gap-2">
          <ExportButton sessionId={sessionId} light />
          <button
            type="button"
            onClick={downloadMemo}
            className="w-full py-2.5 rounded-xl type-label text-[10px] font-bold border-2 border-[#6b4423] text-[#6b4423] hover:bg-[#f5ebe0]"
          >
            Download IC memo
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-[#8b5a2b] italic">Available when analysis completes.</p>
      )}
    </div>
  );
}
