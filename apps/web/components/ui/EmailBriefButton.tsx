'use client';

import { useState } from 'react';

interface EmailBriefButtonProps {
  sessionId: string;
  disabled?: boolean;
}

export default function EmailBriefButton({ sessionId, disabled }: EmailBriefButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/outbound/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, recipients: [email] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(`Sent — ${data.subject}`);
      setOpen(false);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-[10px] px-3 py-1 rounded-full border border-[#6b4423] text-[#6b4423] bg-white shrink-0 disabled:opacity-50"
      >
        Email brief
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 ml-auto min-w-[200px]">
      <div className="flex gap-1.5 items-center">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="recipient@company.com"
          className="flex-1 min-w-0 text-[10px] px-2 py-1 rounded-full border border-[#d4c4b0] bg-white"
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !email.includes('@')}
          className="text-[10px] px-2.5 py-1 rounded-full bg-[#6b4423] text-white shrink-0 disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-[#8b5a2b] shrink-0"
        >
          ✕
        </button>
      </div>
      {error && <p className="text-[9px] text-[#c62828]">{error}</p>}
      {result && <p className="text-[9px] text-[#2e7d32]">{result}</p>}
    </div>
  );
}
