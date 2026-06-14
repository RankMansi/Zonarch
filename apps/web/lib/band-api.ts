/**
 * Band REST client — https://docs.band.ai/api/introduction
 * Human API (band_u_* keys): rooms, participants, message listing
 * Agent API (agent keys): posting audit events to chat rooms
 */

const DEFAULT_BASE = 'https://app.band.ai';

export class BandApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'BandApiError';
    this.status = status;
    this.code = code;
  }
}

function baseUrl(): string {
  return (process.env.BAND_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

async function bandFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...init?.headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const err = body as { error?: { message?: string; code?: string } } | null;
    throw new BandApiError(
      err?.error?.message || `Band API ${res.status}: ${path}`,
      res.status,
      err?.error?.code
    );
  }

  return body as T;
}

export interface MeChatRoom {
  id: string;
  title: string | null;
  status: string;
  type: string;
  inserted_at: string;
  updated_at: string;
}

export interface MyAgent {
  id: string;
  name: string;
  description: string | null;
  is_external: boolean;
  slug: string | null;
}

export interface BandChatMessage {
  id: string;
  chat_room_id: string;
  content: string;
  message_type: string;
  sender_id: string;
  sender_type: string;
  sender_name?: string;
  inserted_at: string;
  metadata?: Record<string, unknown>;
}

export function isBandConfigured(): boolean {
  const human = process.env.BAND_API_KEY || '';
  const agent = process.env.BAND_AGENT_API_KEY || '';
  return (
    (human.startsWith('band_') && human !== 'dev-key') ||
    (agent.startsWith('band_a_') && agent.length > 10)
  );
}

export function isHumanApiKey(key: string): boolean {
  return key.startsWith('band_u_');
}

export async function createAgentChatRoom(
  agentApiKey: string,
  title: string
): Promise<MeChatRoom> {
  const res = await bandFetch<{ data: MeChatRoom }>('/api/v1/agent/chats', agentApiKey, {
    method: 'POST',
    body: JSON.stringify({ chat: { title } }),
  });
  return res.data;
}

/** Human API — requires Enterprise plan for some accounts */
export async function createChatRoom(
  humanApiKey: string,
  title: string
): Promise<MeChatRoom> {
  const res = await bandFetch<{ data: MeChatRoom }>('/api/v1/me/chats', humanApiKey, {
    method: 'POST',
    body: JSON.stringify({ chat: { title } }),
  });
  return res.data;
}

export async function listMyAgents(humanApiKey: string, name?: string): Promise<MyAgent[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (name) params.set('name', name);
  const res = await bandFetch<{ data: MyAgent[] }>(
    `/api/v1/me/agents?${params}`,
    humanApiKey
  );
  return res.data;
}

export async function registerAgent(
  humanApiKey: string,
  name: string,
  description: string
): Promise<{ agent: MyAgent; apiKey: string }> {
  const res = await bandFetch<{
    data: { agent: MyAgent; credentials: { api_key: string } };
  }>('/api/v1/me/agents/register', humanApiKey, {
    method: 'POST',
    body: JSON.stringify({ agent: { name, description } }),
  });
  return { agent: res.data.agent, apiKey: res.data.credentials.api_key };
}

export async function addChatParticipant(
  humanApiKey: string,
  chatId: string,
  participantId: string
): Promise<void> {
  await bandFetch(`/api/v1/me/chats/${chatId}/participants`, humanApiKey, {
    method: 'POST',
    body: JSON.stringify({ participant: { participant_id: participantId } }),
  });
}

export type BandEventMessageType = 'task' | 'thought' | 'error' | 'tool_call' | 'tool_result';

export async function createAgentChatEvent(
  agentApiKey: string,
  chatId: string,
  event: {
    content: string;
    message_type: BandEventMessageType;
    metadata?: Record<string, unknown>;
  }
): Promise<{ id: string }> {
  const res = await bandFetch<{ data: { id: string; success: boolean } }>(
    `/api/v1/agent/chats/${chatId}/events`,
    agentApiKey,
    {
      method: 'POST',
      body: JSON.stringify({ event }),
    }
  );
  return { id: res.data.id };
}

export async function getAgentChatContext(
  agentApiKey: string,
  chatId: string,
  opts?: { since?: string; limit?: number }
): Promise<BandChatMessage[]> {
  const params = new URLSearchParams({ limit: String(opts?.limit ?? 100) });
  if (opts?.since) params.set('since', opts.since);

  const res = await bandFetch<{ data: BandChatMessage[] }>(
    `/api/v1/agent/chats/${chatId}/context?${params}`,
    agentApiKey
  );
  return res.data;
}

/** Human API — requires Enterprise plan for message listing on some accounts */
export async function listChatMessages(
  humanApiKey: string,
  chatId: string,
  opts?: { since?: string; limit?: number }
): Promise<BandChatMessage[]> {
  const params = new URLSearchParams({ limit: String(opts?.limit ?? 100) });
  if (opts?.since) params.set('since', opts.since);

  const res = await bandFetch<{ data: BandChatMessage[] }>(
    `/api/v1/me/chats/${chatId}/messages?${params}`,
    humanApiKey
  );
  return res.data;
}
