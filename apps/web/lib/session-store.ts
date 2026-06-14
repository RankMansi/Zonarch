import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import { globalEvents, globalRooms } from './band-client';

export interface SessionRecord {
  id: string;
  rawInput: string;
  bandRoomId: string | null;
  status: ZoneDraftRoomSchema['status'];
  createdAt: number;
  error?: string;
}

const sessions = new Map<string, SessionRecord>();

export function createSession(rawInput: string, bandRoomId: string | null): SessionRecord {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const session: SessionRecord = {
    id,
    rawInput,
    bandRoomId,
    status: 'RUNNING',
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): SessionRecord | undefined {
  return sessions.get(id);
}

export function updateSessionStatus(
  id: string,
  status: ZoneDraftRoomSchema['status']
): void {
  const session = sessions.get(id);
  if (session) session.status = status;
}

export function getSessionByRoomId(roomId: string): SessionRecord | undefined {
  for (const session of sessions.values()) {
    if (session.bandRoomId === roomId) return session;
  }
  return undefined;
}

export function getRoomEvents(roomId: string) {
  return globalEvents.get(roomId) || [];
}

export function getRoomSchema(roomId: string): ZoneDraftRoomSchema | null {
  const room = globalRooms.get(roomId);
  return room ? JSON.parse(JSON.stringify(room.schema)) : null;
}
