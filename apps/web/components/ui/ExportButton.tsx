'use client';

import { useState } from 'react';

interface ExportButtonProps {
  sessionId: string;
  light?: boolean;
}

export default function ExportButton({ sessionId, light = false }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/${sessionId}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zone-draft-${sessionId.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed — underwriting may not be complete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`w-full py-3 rounded-xl type-label font-bold transition-all duration-300 disabled:opacity-50 ${
        light
          ? 'bg-[#6b4423] text-[#f5ebe0] hover:bg-[#4a3728]'
          : 'border border-[#6b4423] text-[#c8956c] hover:bg-[#6b4423] hover:text-[#ede4d9]'
      }`}
    >
      {loading ? '[ Generating ZIP... ]' : '[ Download Audit Package ]'}
    </button>
  );
}
