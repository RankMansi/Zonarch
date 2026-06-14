import { NextResponse } from 'next/server';
import { createUnderwritingRoom, runUnderwriting } from '@/lib/orchestrator';
import { createSession, updateSessionStatus } from '@/lib/session-store';

export async function POST(req: Request) {
  try {
    const { rawInput } = await req.json();
    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json({ error: 'rawInput required' }, { status: 400 });
    }

    const session = createSession(rawInput, null);
    const roomId = await createUnderwritingRoom(session.id);
    session.bandRoomId = roomId;

    runUnderwriting(session.id, rawInput, roomId).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      session.status = 'FAILED';
      session.error = message;
      updateSessionStatus(session.id, 'FAILED');
    });

    return NextResponse.json({ sessionId: session.id, roomId, status: 'RUNNING' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
