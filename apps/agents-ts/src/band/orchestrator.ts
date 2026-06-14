/** Band orchestrator — top-level flow controller */

import axios from 'axios';
import { intakeParser } from '../agents/intake-parser';
import { financialUnderwriter } from '../agents/financial-underwriter';

const GEO_AGENT_URL = process.env.GEO_AGENT_URL || 'http://localhost:8000';
const WEB_URL = process.env.WEB_ORCHESTRATOR_URL || 'http://localhost:3000';

export async function runUnderwriting(sessionId: string, rawInput: string, roomId: string) {
  await axios.post(`${WEB_URL}/api/band/${roomId}`, {
    key: 'status',
    value: 'RUNNING',
  });

  const intakeResult = await intakeParser.generate([
    { role: 'user', content: `Parse and geocode: "${rawInput}". Room ID: ${roomId}` },
  ]);

  const zoningRes = await axios.post(`${GEO_AGENT_URL}/run-zoning-agent`, { room_id: roomId });
  const spatialRes = await axios.post(`${GEO_AGENT_URL}/run-spatial-agent`, { room_id: roomId });

  const finResult = await financialUnderwriter.generate([
    { role: 'user', content: `Run RLV model for room: ${roomId}` },
  ]);

  return {
    intake: intakeResult.text,
    zoning: zoningRes.data.log,
    spatial: spatialRes.data.log,
    financial: finResult.text,
  };
}
