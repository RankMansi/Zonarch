'use client';

interface SiteViewerFooterProps {
  heightFt: number;
  floors: number;
  gfaSqft: number;
  verdict?: string;
}

export default function SiteViewerFooter({
  heightFt,
  floors,
  gfaSqft,
  verdict,
}: SiteViewerFooterProps) {
  return (
    <footer className="site-viewer-footer px-4 py-2.5 border-t border-[#d4c4b0]/70 bg-[#e8e0d4]/95 backdrop-blur-sm shrink-0">
      <p className="text-sm font-mono font-semibold text-[#2c1810]">
        {Math.round(heightFt)} ft · ~{floors} floors · {gfaSqft.toLocaleString()} sf
        {verdict ? ` · ${verdict}` : ''}
      </p>
      <p className="text-[10px] text-[#8b5a2b] mt-0.5">
        Zoning envelope visualization — not architectural design or legal advice.
      </p>
    </footer>
  );
}
