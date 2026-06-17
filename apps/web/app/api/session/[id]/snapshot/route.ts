import { NextResponse } from 'next/server';
import { getSession, getRoomSchema } from '@/lib/session-store';
import type { SessionStatus } from '@/types/zone-draft';

function mapSchemaStatus(status: string | undefined): SessionStatus {
  if (status === 'APPROVED') return 'complete';
  if (status === 'FAILED') return 'failed';
  if (status === 'RUNNING') return 'running';
  return 'idle';
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const schema = session.bandRoomId ? getRoomSchema(session.bandRoomId) : null;
  const status = mapSchemaStatus(schema?.status ?? session.status);

  return NextResponse.json({
    sessionId: session.id,
    rawInput: session.rawInput,
    status,
    schema,
  });
}
