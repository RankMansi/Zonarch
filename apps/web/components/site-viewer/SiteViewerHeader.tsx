'use client';

import Link from 'next/link';

interface SiteViewerHeaderProps {
  address: string;
  bbl: string;
  zonedist1: string;
  sessionId: string;
}

export default function SiteViewerHeader({
  address,
  bbl,
  zonedist1,
  sessionId,
}: SiteViewerHeaderProps) {
  return (
    <header className="site-viewer-header flex items-center justify-between gap-4 px-4 py-2.5 border-b border-[#d4c4b0]/70 bg-[#e8e0d4]/95 backdrop-blur-sm shrink-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#2c1810] truncate">{address}</p>
        <p className="text-xs text-[#6b4423] font-mono truncate">
          BBL {bbl} · {zonedist1}
        </p>
      </div>
      <Link
        href={`/underwrite?session=${sessionId}`}
        className="shrink-0 text-xs font-semibold text-[#6b4423] hover:text-[#2c1810] border border-[#8b5a2b]/40 rounded-lg px-3 py-1.5 bg-white/60"
      >
        ← Back to analysis
      </Link>
    </header>
  );
}
