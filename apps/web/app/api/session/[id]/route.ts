import { bandClient, globalEvents } from '@/lib/band-client';
import { getSession, getRoomSchema } from '@/lib/session-store';

const TERMINAL_EVENTS = new Set(['session.complete', 'session.error']);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session?.bandRoomId) {
    return new Response('Session not found or not started', { status: 404 });
  }

  const encoder = new TextEncoder();
  const roomId = session.bandRoomId;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let terminalHandled = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let closeTimer: ReturnType<typeof setTimeout> | null = null;
      let unsubscribe: (() => void) | null = null;

      const safeClose = () => {
        if (closed) return;
        closed = true;
        if (closeTimer) clearTimeout(closeTimer);
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const handleTerminal = () => {
        if (terminalHandled || closed) return;
        terminalHandled = true;
        const finalSchema = getRoomSchema(roomId);
        if (finalSchema) {
          send({ type: 'context.full', data: finalSchema });
        }
        send({ type: 'stream.end' });
        closeTimer = setTimeout(safeClose, 100);
      };

      send({ type: 'connected', sessionId: id, roomId });

      const schema = getRoomSchema(roomId);
      if (schema?.lot_data) send({ type: 'context.lot_data', data: schema.lot_data });
      if (schema?.building_envelope) {
        send({ type: 'context.building_envelope', data: schema.building_envelope });
      }
      if (schema?.financial_analysis) {
        send({ type: 'context.financial_analysis', data: schema.financial_analysis });
      }
      if (schema?.zoning_analysis) send({ type: 'context.zoning_analysis', data: schema.zoning_analysis });

      const buffered = globalEvents.get(roomId) || [];
      for (const event of buffered) {
        send({ type: event.event, ...event });
        if (TERMINAL_EVENTS.has(event.event)) {
          handleTerminal();
        }
      }

      if (terminalHandled) {
        req.signal.addEventListener('abort', safeClose);
        return;
      }

      unsubscribe = await bandClient.rooms.subscribe(
        roomId,
        (event) => {
          send({ type: event.event, ...event });
          if (TERMINAL_EVENTS.has(event.event)) {
            handleTerminal();
          }
        },
        { replay: false }
      );

      heartbeat = setInterval(() => send({ type: 'heartbeat' }), 15000);
      req.signal.addEventListener('abort', safeClose);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
