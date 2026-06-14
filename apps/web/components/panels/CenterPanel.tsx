'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TerminalMessage } from '@/types/zone-draft';
import TerminalLine from '@/components/ui/TerminalLine';
import ConstraintDebugger from '@/components/ui/ConstraintDebugger';
import { useBandStream, type BandStreamCallbacks } from '@/hooks/useBandStream';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;

interface CenterPanelProps extends BandStreamCallbacks {
  sessionId: string | null;
  onStepLabel?: (label: string) => void;
  onError?: (message: string) => void;
  envelopeData?: EnvelopeData | null;
}

const AGENT_STEPS = [
  { key: 'INTAKE', label: 'Site' },
  { key: 'ZONING', label: 'Zoning' },
  { key: 'SPATIAL', label: 'Envelope' },
  { key: 'FINANCIAL', label: 'Economics' },
];

export default function CenterPanel({
  sessionId,
  onLotData,
  onEnvelopeData,
  onFinancialData,
  onZoningData,
  onStatusChange,
  onStepLabel,
  onError,
  envelopeData,
}: CenterPanelProps) {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [activeStep, setActiveStep] = useState(-1);
  const [violations, setViolations] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);

  const handleMessage = useCallback((msg: Omit<TerminalMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: `${Date.now()}_${Math.random()}`, timestamp: Date.now() },
    ]);
    if (msg.type === 'violation' && msg.content) {
      setViolations((c) => [...c, msg.content as string]);
    }
  }, []);

  const handleActiveStep = useCallback(
    (step: number) => {
      setActiveStep(step);
      onStepLabel?.(AGENT_STEPS[step]?.label ?? '');
    },
    [onStepLabel]
  );

  useEffect(() => {
    if (sessionId !== sessionRef.current) {
      sessionRef.current = sessionId;
      setMessages([]);
      setActiveStep(-1);
      setViolations([]);
    }
  }, [sessionId]);

  useBandStream(sessionId, {
    onLotData,
    onEnvelopeData,
    onFinancialData,
    onZoningData,
    onStatusChange,
    onMessage: handleMessage,
    onActiveStep: handleActiveStep,
    onError,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const progressPct = activeStep < 0 ? 0 : ((activeStep + 1) / AGENT_STEPS.length) * 100;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
        {AGENT_STEPS.map((step, i) => (
          <span
            key={step.key}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              i <= activeStep
                ? 'bg-[#6b4423] text-[#f5ebe0] border-[#6b4423]'
                : 'bg-white text-[#6b4423] border-[#d4c4b0]'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>

      <div className="h-1 bg-[#ede4d9] rounded-full overflow-hidden mb-2 shrink-0">
        <div
          className="h-full bg-[#8b5a2b] rounded-full transition-[width] duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ConstraintDebugger envelopeData={envelopeData ?? null} violations={violations} />

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto terminal-scroll-light bg-white/80 rounded-xl border border-[#d4c4b0]/50 px-3 py-2 space-y-1"
      >
        {messages.length === 0 && (
          <p className="text-xs text-[#8b5a2b] mt-1">
            Progress appears here. Your recommendation is on the right.
          </p>
        )}
        {messages.map((msg) => (
          <TerminalLine key={msg.id} message={msg} light />
        ))}
      </div>
    </div>
  );
}
