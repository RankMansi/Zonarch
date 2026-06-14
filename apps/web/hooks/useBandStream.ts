'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TerminalMessage, SessionStatus } from '@/types/zone-draft';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;
type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;
type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;
type ZoningData = NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;

export interface BandStreamCallbacks {
  onLotData?: (data: LotData) => void;
  onEnvelopeData?: (data: EnvelopeData) => void;
  onFinancialData?: (data: FinancialData) => void;
  onZoningData?: (data: ZoningData) => void;
  onStatusChange?: (status: SessionStatus) => void;
  onMessage?: (msg: Omit<TerminalMessage, 'id' | 'timestamp'>) => void;
  onActiveStep?: (step: number) => void;
  onError?: (message: string) => void;
}

const AGENT_STEP_KEYS = ['INTAKE', 'ZONING', 'SPATIAL', 'FINANCIAL'] as const;
const TERMINAL_TYPES = new Set(['session.complete', 'session.error', 'stream.end']);

function parseSSEChunk(chunk: string): Record<string, unknown> | null {
  const line = chunk
    .split('\n')
    .find((l) => l.startsWith('data: '));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

async function consumeEventStream(
  url: string,
  signal: AbortSignal,
  onEvent: (data: Record<string, unknown>) => void
) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'text/event-stream' },
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const data = parseSSEChunk(part);
      if (data) onEvent(data);
    }
  }
}

export function useBandStream(sessionId: string | null, callbacks: BandStreamCallbacks) {
  const [connected, setConnected] = useState(false);
  const [terminalReached, setTerminalReached] = useState(false);
  const callbacksRef = useRef(callbacks);
  const seenEventsRef = useRef(new Set<string>());

  callbacksRef.current = callbacks;

  const eventKey = useCallback((data: Record<string, unknown>) => {
    const type = String(data.type ?? data.event ?? '');
    if (type === 'heartbeat' || type === 'connected') return '';
    if (type === 'agent.message') {
      return `${type}:${data.agent}:${data.content}`;
    }
    return `${type}:${JSON.stringify(data)}`;
  }, []);

  const handleEvent = useCallback(
    (data: Record<string, unknown>) => {
      const type = String(data.type ?? data.event ?? '');

      if (type === 'heartbeat' || type === 'connected') return;

      const key = eventKey(data);
      if (key && seenEventsRef.current.has(key)) return;
      if (key) seenEventsRef.current.add(key);

      const cb = callbacksRef.current;

      if (type === 'context.lot_data') cb.onLotData?.(data.data as LotData);
      if (type === 'context.building_envelope') {
        cb.onEnvelopeData?.(data.data as EnvelopeData);
      }
      if (type === 'context.financial_analysis') {
        cb.onFinancialData?.(data.data as FinancialData);
      }
      if (type === 'context.zoning_analysis') {
        cb.onZoningData?.(data.data as ZoningData);
      }
      if (type === 'context.full') {
        const full = data.data as ZoneDraftRoomSchema;
        if (full.lot_data) cb.onLotData?.(full.lot_data);
        if (full.building_envelope) cb.onEnvelopeData?.(full.building_envelope);
        if (full.financial_analysis) cb.onFinancialData?.(full.financial_analysis);
        if (full.zoning_analysis) cb.onZoningData?.(full.zoning_analysis);
      }

      if (type === 'session.started') {
        cb.onMessage?.({ type: 'system', content: `Starting analysis for: ${data.rawInput}` });
      }

      if (type === 'agent.activated') {
        const agent = String(data.agent ?? '').toUpperCase();
        const stepIdx = AGENT_STEP_KEYS.findIndex((s) => agent.includes(s));
        if (stepIdx >= 0) cb.onActiveStep?.(stepIdx);
        const labels: Record<string, string> = {
          INTAKE: 'Looking up site and parcel data…',
          ZONING: 'Applying zoning rules and UAP bonuses…',
          SPATIAL: 'Computing buildable envelope…',
          FINANCIAL: 'Running comps and land-value model…',
        };
        const key = AGENT_STEP_KEYS.find((s) => agent.includes(s)) ?? '';
        cb.onMessage?.({ type: 'system', content: labels[key] || `Working: ${data.agent}` });
      }

      if (type === 'agent.message') {
        cb.onMessage?.({
          type: 'agent',
          agent: String(data.agent),
          content: String(data.content),
        });
      }

      if (type === 'constraint.violation') {
        cb.onMessage?.({ type: 'violation', content: String(data.content) });
      }

      if (type === 'constraint.resolved') {
        cb.onMessage?.({ type: 'resolution', content: String(data.content) });
      }

      if (type === 'session.complete') {
        setTerminalReached(true);
        cb.onStatusChange?.('complete');
        cb.onMessage?.({
          type: 'system',
          content:
            'All analysis steps finished. See Deal Metrics for your BUY / HOLD / PASS recommendation.',
        });
      }

      if (type === 'session.error') {
        setTerminalReached(true);
        cb.onStatusChange?.('failed');
        cb.onError?.(String(data.error));
        cb.onMessage?.({
          type: 'system',
          content: `Analysis stopped: ${data.error}`,
        });
      }

      if (type === 'stream.end') {
        setTerminalReached(true);
      }
    },
    [eventKey]
  );

  useEffect(() => {
    if (!sessionId) {
      setConnected(false);
      setTerminalReached(false);
      return;
    }

    seenEventsRef.current.clear();
    setTerminalReached(false);

    const abort = new AbortController();
    let active = true;

    consumeEventStream(`/api/session/${sessionId}`, abort.signal, handleEvent)
      .then(() => {
        if (active) setConnected(false);
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setConnected(false);
        }
      });

    setConnected(true);

    return () => {
      active = false;
      abort.abort();
      setConnected(false);
    };
  }, [sessionId, handleEvent]);

  return { connected, terminalReached };
}
