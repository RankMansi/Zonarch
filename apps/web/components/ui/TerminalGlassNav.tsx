'use client';

import Link from 'next/link';
import type { SessionStatus } from '@/types/zone-draft';

interface TerminalGlassNavProps {
  status: SessionStatus;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'Ready',
  running: 'Analyzing',
  complete: 'Analysis complete',
  failed: 'Failed',
};

export default function TerminalGlassNav({ status }: TerminalGlassNavProps) {
  return (
    <header className="bento-nav-wrap">
      <nav className="glass-nav-terminal flex items-center justify-between gap-4 px-5 md:px-7 py-3.5 md:py-4 w-full max-w-[1600px]">
        <div className="flex items-center gap-4 md:gap-6 min-w-0">
          <Link
            href="/"
            className="type-label text-[#2c1810] hover:text-[#6b4423] transition-colors shrink-0 flex items-center gap-2"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">Studio</span>
          </Link>
          <div className="h-5 w-px bg-[#6b4423]/25 hidden sm:block" />
          <div className="min-w-0">
            <p className="text-lg md:text-xl font-bold tracking-tight text-[#2c1810] truncate" style={{ fontFamily: 'var(--font-syne)' }}>
              Zone·Draft
            </p>
            <p className="type-label text-[#6b4423] text-[10px] md:text-xs truncate">
              NYC Underwriting Workbench
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`type-label text-[10px] md:text-xs px-3 py-1.5 rounded-full border ${
              status === 'complete'
                ? 'bg-[#ede4d9] border-[#8b5a2b] text-[#6b4423]'
                : status === 'failed'
                  ? 'bg-[#ffebee] border-[#c62828] text-[#b71c1c]'
                  : status === 'running'
                    ? 'bg-[#fff3e0] border-[#c8956c] text-[#6b4423]'
                    : 'bg-white/60 border-[#d4c4b0] text-[#6b4423]'
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
          <Link
            href="/underwrite"
            className="type-label text-[#f5ebe0] bg-[#6b4423] px-4 py-2 rounded-full hover:bg-[#4a3728] transition-colors hidden md:inline-flex"
          >
            Terminal
          </Link>
        </div>
      </nav>
    </header>
  );
}
