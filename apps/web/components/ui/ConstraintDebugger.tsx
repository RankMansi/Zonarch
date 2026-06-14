'use client';

import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;

interface ConstraintDebuggerProps {
  envelopeData: EnvelopeData | null;
  violations: string[];
}

export default function ConstraintDebugger({
  envelopeData,
  violations,
}: ConstraintDebuggerProps) {
  const log = envelopeData?.violation_log ?? [];
  if (violations.length === 0 && log.length === 0) return null;

  const heightBefore = envelopeData?.floors_standard;
  const heightAfter = envelopeData?.floors_with_uap;

  return (
    <div className="rounded-xl border border-[#c8956c]/50 bg-[#fff8e1] px-3 py-2.5 space-y-2">
      <p className="text-xs font-semibold text-[#8b5a2b]">Constraint debugger</p>
      {violations.map((v, i) => (
        <p key={i} className="text-xs text-[#5c4033]">
          <span className="text-[#c62828]">Issue:</span> {v}
        </p>
      ))}
      {log.map((entry, i) => (
        <div key={i} className="text-xs text-[#5c4033] border-t border-[#d4c4b0]/40 pt-1.5">
          <p>
            <span className="font-semibold">{entry.type}:</span> {entry.description}
          </p>
          <p className="text-[#2e7d32]">Fix: {entry.resolution}</p>
        </div>
      ))}
      {heightBefore !== undefined && heightAfter !== undefined && log.length > 0 && (
        <div className="flex gap-3 text-[10px] font-mono">
          <span className="px-2 py-1 bg-white rounded border border-[#d4c4b0]">
            Before: ~{heightBefore} fl
          </span>
          <span aria-hidden>→</span>
          <span className="px-2 py-1 bg-white rounded border border-[#7cb342]">
            After: {heightAfter} fl
          </span>
        </div>
      )}
    </div>
  );
}
