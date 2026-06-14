'use client';

import { useState } from 'react';
import { getZoningCitations } from '@/lib/underwriting-glossary';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type ZoningData = NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;
type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;

interface ZoningCitationsProps {
  zoningData: ZoningData | null;
  lotData: LotData | null;
}

export default function ZoningCitations({ zoningData, lotData }: ZoningCitationsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');

  if (!zoningData || !lotData) return null;

  const citations = getZoningCitations(
    lotData.zonedist1,
    zoningData.applicable_zr_sections
  );

  return (
    <div className="rounded-xl border border-[#d4c4b0]/60 bg-white px-3 py-3 space-y-2">
      <p className="text-xs font-semibold text-[#2c1810]">Zoning sources</p>
      <p className="text-[10px] text-[#8b5a2b]">Tap a section to read the excerpt and why it applies.</p>
      <ul className="space-y-1.5">
        {citations.map((c) => (
          <li key={c.section} className="border border-[#d4c4b0]/40 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === c.section ? null : c.section)}
              className="w-full text-left px-2.5 py-2 text-xs font-mono text-[#6b4423] hover:bg-[#f5ebe0]"
            >
              {c.section} — {c.title}
            </button>
            {expanded === c.section && (
              <div className="px-2.5 pb-2 space-y-2 bg-[#faf6f1]">
                <p className="text-xs text-[#2c1810] italic leading-relaxed">&ldquo;{c.excerpt}&rdquo;</p>
                <p className="text-[10px] text-[#5c4033]">
                  <span className="font-semibold">Why here:</span> {c.appliesBecause}
                </p>
                <input
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Ask a follow-up on this section…"
                  className="w-full text-[10px] border border-[#d4c4b0] rounded px-2 py-1"
                />
                {followUp && (
                  <p className="text-[10px] text-[#6b4423]">
                    Follow-up noted — full RAG chat requires the Python geo-agent with ingested ZR docs.
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
