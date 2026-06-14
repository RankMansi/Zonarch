/**
 * Ensures a Zone-Draft orchestrator agent exists on Band for posting audit events.
 * Uses Human API (band_u_*) to register agents; Agent API (band_a_*) for chat rooms.
 * @see https://docs.band.ai/api/introduction
 */

import fs from 'fs';
import path from 'path';
import { isHumanApiKey, listMyAgents, registerAgent } from './band-api';

const ORCHESTRATOR_NAME = 'Zone-Draft Orchestrator';
const ORCHESTRATOR_DESC =
  'Multi-agent NYC real estate underwriting pipeline for Zone-Draft.';

export interface AgentCredentials {
  agentId: string;
  apiKey: string;
}

let cached: AgentCredentials | null = null;

function credentialsPath(): string {
  return path.join(process.cwd(), '.band-orchestrator.json');
}

function readCachedCredentials(): AgentCredentials | null {
  try {
    const raw = fs.readFileSync(credentialsPath(), 'utf8');
    const parsed = JSON.parse(raw) as AgentCredentials;
    if (parsed.agentId && parsed.apiKey?.startsWith('band_a_')) return parsed;
  } catch {
    /* no cache */
  }
  return null;
}

function writeCachedCredentials(creds: AgentCredentials): void {
  try {
    fs.writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2), 'utf8');
  } catch (err) {
    console.warn('[band] Could not persist orchestrator credentials:', err);
  }
}

export async function getOrchestratorCredentials(
  humanApiKey: string
): Promise<AgentCredentials> {
  if (cached) return cached;

  const envAgentKey = process.env.BAND_AGENT_API_KEY;
  const envAgentId = process.env.BAND_AGENT_ID;

  if (envAgentKey?.startsWith('band_a_')) {
    cached = {
      agentId: envAgentId || '',
      apiKey: envAgentKey,
    };
    if (!cached.agentId) {
      const agents = await listMyAgents(humanApiKey, ORCHESTRATOR_NAME);
      const match = agents.find((a) => a.name === ORCHESTRATOR_NAME);
      if (match) cached.agentId = match.id;
    }
    return cached;
  }

  const fromFile = readCachedCredentials();
  if (fromFile) {
    cached = fromFile;
    return cached;
  }

  if (!isHumanApiKey(humanApiKey)) {
    throw new Error(
      'BAND_API_KEY must be a Human API key (band_u_*) to register the orchestrator agent, ' +
        'or set BAND_AGENT_API_KEY (band_a_*) directly.'
    );
  }

  const existing = await listMyAgents(humanApiKey, ORCHESTRATOR_NAME);
  const found = existing.find((a) => a.name === ORCHESTRATOR_NAME);
  if (found) {
    throw new Error(
      `Band agent "${ORCHESTRATOR_NAME}" (${found.id}) exists but no API key is configured. ` +
        'Set BAND_AGENT_API_KEY in .env or delete .band-orchestrator.json and re-register.'
    );
  }

  const { agent, apiKey } = await registerAgent(
    humanApiKey,
    ORCHESTRATOR_NAME,
    ORCHESTRATOR_DESC
  );
  const creds = { agentId: agent.id, apiKey };
  writeCachedCredentials(creds);
  console.info(
    `[band] Registered orchestrator agent ${agent.id}. ` +
      'Credentials saved to .band-orchestrator.json — add BAND_AGENT_API_KEY to .env.'
  );
  cached = creds;
  return creds;
}
