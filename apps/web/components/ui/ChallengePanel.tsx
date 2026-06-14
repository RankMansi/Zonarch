'use client';

import { useState } from 'react';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;

interface ChallengePanelProps {
  sessionId: string | null;
  financialData: FinancialData | null;
  onUpdate: (data: FinancialData) => void;
  disabled?: boolean;
}

export default function ChallengePanel({
  sessionId,
  financialData,
  onUpdate,
  disabled,
}: ChallengePanelProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  const examples = [
    'What if land is $12M?',
    'What PSF do I need for BUY?',
    'What if exit PSF is $950?',
  ];

  const submit = async (q: string) => {
    if (!sessionId || !q.trim()) return;
    setLoading(true);
    setReply(null);
    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, question: q.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scenario failed');
      onUpdate(data.financial);
      setReply(data.answer);
    } catch (e) {
      setReply(e instanceof Error ? e.message : 'Could not run scenario');
    } finally {
      setLoading(false);
    }
  };

  if (!financialData) return null;

  return (
    <div className="rounded-xl border border-[#d4c4b0]/60 bg-white px-3 py-3 space-y-2">
      <p className="text-xs font-semibold text-[#2c1810]">Challenge the model</p>
      <p className="text-[10px] text-[#8b5a2b]">
        Ask what-if questions — only the money math re-runs, not the full pipeline.
      </p>
      <div className="flex flex-wrap gap-1">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={disabled || loading || !sessionId}
            onClick={() => {
              setQuestion(ex);
              submit(ex);
            }}
            className="text-[10px] px-2 py-0.5 rounded-full border border-[#d4c4b0] text-[#6b4423] hover:bg-[#f5ebe0] disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What if hard cost is $450/sf?"
          disabled={disabled || loading || !sessionId}
          className="flex-1 text-xs border border-[#d4c4b0] rounded-lg px-2 py-1.5 font-mono"
        />
        <button
          type="submit"
          disabled={disabled || loading || !sessionId}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#6b4423] text-white disabled:opacity-50"
        >
          {loading ? '…' : 'Run'}
        </button>
      </form>
      {reply && <p className="text-xs text-[#2e7d32] bg-[#e8f5e9] rounded-lg px-2 py-1.5">{reply}</p>}
    </div>
  );
}
