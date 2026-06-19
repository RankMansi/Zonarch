import type { BandEvent, ZoneDraftRoomSchema } from '@/types/zone-draft';
import {
  createAgentChatEvent,
  createAgentChatRoom,
  getAgentChatContext,
  isBandConfigured,
  type BandEventMessageType,
} from './band-api';
import { getOrchestratorCredentials } from './band-agent-setup';

type EventCallback = (event: BandEvent) => void;

interface RoomState {
  id: string;
  name: string;
  schema: ZoneDraftRoomSchema;
  participants: string[];
  subscribers: Set<EventCallback>;
  bandEnabled: boolean;
  /** ISO timestamp for Band context polling cursor */
  pollSince?: string;
  seenMessageIds: Set<string>;
}

const globalRooms = new Map<string, RoomState>();
const globalEvents = new Map<string, BandEvent[]>();

const ZONE_DRAFT_META = 'zone_draft_event';

function createInitialSchema(overrides?: Partial<ZoneDraftRoomSchema>): ZoneDraftRoomSchema {
  return {
    lot_data: null,
    zoning_analysis: null,
    building_envelope: null,
    financial_analysis: null,
    outbound_email: null,
    status: 'PENDING',
    iteration_count: 0,
    error_log: [],
    ...overrides,
  };
}

function eventToBandMessage(event: BandEvent): {
  content: string;
  message_type: BandEventMessageType;
} {
  switch (event.event) {
    case 'session.error':
      return { content: event.error || 'Session error', message_type: 'error' };
    case 'agent.message':
      return {
        content: `[${event.agent}] ${event.content || ''}`,
        message_type: 'thought',
      };
    case 'agent.activated':
      return {
        content: `Activated: ${event.agent}`,
        message_type: 'task',
      };
    default:
      return {
        content: event.content || event.event.replace(/\./g, ' '),
        message_type: 'task',
      };
  }
}

function messageToBandEvent(msg: {
  id: string;
  content: string;
  message_type: string;
  metadata?: Record<string, unknown>;
}): BandEvent | null {
  const meta = msg.metadata?.[ZONE_DRAFT_META];
  if (meta && typeof meta === 'object') {
    return meta as BandEvent;
  }
  if (msg.message_type === 'text') return null;
  return {
    event: `band.${msg.message_type}`,
    content: msg.content,
  };
}

function deliverEvent(roomId: string, event: BandEvent): void {
  const events = globalEvents.get(roomId) || [];
  events.push(event);
  globalEvents.set(roomId, events);

  const room = globalRooms.get(roomId);
  room?.subscribers.forEach((cb) => cb(event));
}

class RoomContext {
  constructor(private roomId: string) {}

  async get<K extends keyof ZoneDraftRoomSchema>(
    roomId: string,
    key: K
  ): Promise<ZoneDraftRoomSchema[K]> {
    const room = globalRooms.get(roomId || this.roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    return room.schema[key];
  }

  async set<K extends keyof ZoneDraftRoomSchema>(
    roomIdOrKey: string | K,
    keyOrValue?: K | ZoneDraftRoomSchema[K],
    value?: ZoneDraftRoomSchema[K]
  ): Promise<void> {
    let roomId = this.roomId;
    let key: keyof ZoneDraftRoomSchema;
    let val: ZoneDraftRoomSchema[keyof ZoneDraftRoomSchema];

    if (typeof keyOrValue !== 'undefined' && typeof value !== 'undefined') {
      roomId = roomIdOrKey as string;
      key = keyOrValue as keyof ZoneDraftRoomSchema;
      val = value;
    } else {
      key = roomIdOrKey as keyof ZoneDraftRoomSchema;
      val = keyOrValue as ZoneDraftRoomSchema[keyof ZoneDraftRoomSchema];
    }

    const room = globalRooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    (room.schema as unknown as Record<string, unknown>)[key as string] = val;
  }

  async update(key: keyof ZoneDraftRoomSchema, value: unknown): Promise<void> {
    const room = globalRooms.get(this.roomId);
    if (!room) throw new Error(`Room not found: ${this.roomId}`);
    (room.schema as unknown as Record<string, unknown>)[key as string] = value;
  }

  async getAll(roomId: string): Promise<ZoneDraftRoomSchema> {
    const room = globalRooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    return JSON.parse(JSON.stringify(room.schema));
  }
}

class BandRoom {
  id: string;
  context: RoomContext;

  constructor(id: string) {
    this.id = id;
    this.context = new RoomContext(id);
  }

  async addParticipant(name: string): Promise<void> {
    const room = globalRooms.get(this.id);
    if (room) room.participants.push(name);
  }
}

export class BandClient {
  private humanApiKey: string;
  private useBand: boolean;
  private agentCredentials: { agentId: string; apiKey: string } | null = null;
  rooms: {
    create: (opts: {
      name: string;
      schema: ZoneDraftRoomSchema;
    }) => Promise<BandRoom>;
    subscribe: (
      roomId: string,
      callback: EventCallback,
      options?: { replay?: boolean }
    ) => Promise<() => void>;
  };
  context: RoomContext;

  constructor(opts: { apiKey: string }) {
    this.humanApiKey = opts.apiKey;
    this.useBand = isBandConfigured();
    this.context = new RoomContext('');

    this.rooms = {
      create: async (opts) => this.createRoom(opts),
      subscribe: async (roomId, callback, options) =>
        this.subscribeRoom(roomId, callback, options),
    };
  }

  private async ensureAgent(): Promise<{ agentId: string; apiKey: string }> {
    if (!this.agentCredentials) {
      this.agentCredentials = await getOrchestratorCredentials(this.humanApiKey);
    }
    return this.agentCredentials;
  }

  private registerLocalRoom(
    id: string,
    name: string,
    schema: ZoneDraftRoomSchema,
    bandEnabled: boolean
  ): BandRoom {
    globalRooms.set(id, {
      id,
      name,
      schema: { ...createInitialSchema(), ...schema },
      participants: [],
      subscribers: new Set(),
      bandEnabled,
      seenMessageIds: new Set(),
    });
    globalEvents.set(id, []);
    return new BandRoom(id);
  }

  private async createRoom(opts: {
    name: string;
    schema: ZoneDraftRoomSchema;
  }): Promise<BandRoom> {
    if (!this.useBand) {
      const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return this.registerLocalRoom(id, opts.name, opts.schema, false);
    }

    try {
      const agent = await this.ensureAgent();
      const chat = await createAgentChatRoom(agent.apiKey, opts.name);
      return this.registerLocalRoom(chat.id, opts.name, opts.schema, true);
    } catch (err) {
      console.error('[band] create room failed, using local fallback:', err);
      const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return this.registerLocalRoom(id, opts.name, opts.schema, false);
    }
  }

  private async subscribeRoom(
    roomId: string,
    callback: EventCallback,
    options?: { replay?: boolean }
  ): Promise<() => void> {
    const room = globalRooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);

    if (options?.replay !== false) {
      const existing = globalEvents.get(roomId) || [];
      existing.forEach((e) => callback(e));
    }

    room.subscribers.add(callback);

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    if (room.bandEnabled) {
      pollTimer = setInterval(async () => {
        try {
          await this.pollBandContext(roomId);
        } catch (err) {
          console.warn('[band] poll error:', err);
        }
      }, 1500);
    }

    return () => {
      room.subscribers.delete(callback);
      if (pollTimer) clearInterval(pollTimer);
    };
  }

  private async pollBandContext(roomId: string): Promise<void> {
    const room = globalRooms.get(roomId);
    if (!room?.bandEnabled) return;

    const agent = await this.ensureAgent();
    const messages = await getAgentChatContext(agent.apiKey, roomId, {
      since: room.pollSince,
      limit: 50,
    });

    for (const msg of messages) {
      if (room.seenMessageIds.has(msg.id)) continue;
      room.seenMessageIds.add(msg.id);
      room.pollSince = msg.inserted_at;

      const event = messageToBandEvent(msg);
      if (event) deliverEvent(roomId, event);
    }
  }

  async emit(roomId: string, event: BandEvent): Promise<void> {
    const room = globalRooms.get(roomId);
    if (!room) return;

    deliverEvent(roomId, event);

    if (!room.bandEnabled) return;

    try {
      const agent = await this.ensureAgent();
      const { content, message_type } = eventToBandMessage(event);
      const created = await createAgentChatEvent(agent.apiKey, roomId, {
        content,
        message_type,
        metadata: { [ZONE_DRAFT_META]: event },
      });
      room.seenMessageIds.add(created.id);
    } catch (err) {
      console.warn('[band] emit to Band failed (local event retained):', err);
    }
  }
}

export const bandClient = new BandClient({
  apiKey: process.env.BAND_API_KEY || 'dev-key',
});

export const bandRoom = {
  context: {
    get: async <K extends keyof ZoneDraftRoomSchema>(
      roomId: string,
      key: K
    ): Promise<ZoneDraftRoomSchema[K]> => {
      const room = globalRooms.get(roomId);
      if (!room) throw new Error(`Room not found: ${roomId}`);
      return room.schema[key];
    },
    set: async <K extends keyof ZoneDraftRoomSchema>(
      roomId: string,
      key: K,
      value: ZoneDraftRoomSchema[K]
    ): Promise<void> => {
      const room = globalRooms.get(roomId);
      if (!room) throw new Error(`Room not found: ${roomId}`);
      room.schema[key] = value;
    },
    getAll: async (roomId: string): Promise<ZoneDraftRoomSchema> => {
      const room = globalRooms.get(roomId);
      if (!room) throw new Error(`Room not found: ${roomId}`);
      return JSON.parse(JSON.stringify(room.schema));
    },
  },
};

export { globalRooms, globalEvents, isBandConfigured };
