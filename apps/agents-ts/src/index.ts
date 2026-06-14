import express from 'express';
import axios from 'axios';
import { geocodeNYCAddress } from './tools/geocoder';
import { queryPLUTOByBBL } from './tools/pluto-api';

const app = express();
app.use(express.json());

const PORT = process.env.AGENTS_PORT || 3001;
const GEO_AGENT_URL = process.env.GEO_AGENT_URL || 'http://localhost:8000';
const WEB_URL = process.env.WEB_ORCHESTRATOR_URL || 'http://localhost:3000';

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'agents-ts' }));

app.post('/underwrite', async (req, res) => {
  const { sessionId, rawInput, roomId } = req.body;
  try {
    const geo = await geocodeNYCAddress(rawInput);
    const pluto = await queryPLUTOByBBL(geo.bbl);
    const lotData = {
      bbl: pluto.bbl,
      address: pluto.address,
      borough: pluto.borough,
      block: pluto.block,
      lot: pluto.lot,
      zonedist1: pluto.zonedist1,
      lot_area_sqft: parseFloat(pluto.lotarea),
      lot_depth: parseFloat(pluto.lotdepth),
      lot_frontage: parseFloat(pluto.lotfront),
      latitude: parseFloat(pluto.latitude),
      longitude: parseFloat(pluto.longitude),
      assessland: parseFloat(pluto.assessland),
      yearbuilt: parseInt(pluto.yearbuilt),
    };

    await axios.post(`${WEB_URL}/api/band/${roomId}`, { key: 'lot_data', value: lotData });
    await axios.post(`${GEO_AGENT_URL}/sync-room`, { room_id: roomId, schema: { lot_data: lotData } });
    await axios.post(`${GEO_AGENT_URL}/run-zoning-agent`, { room_id: roomId });
    await axios.post(`${GEO_AGENT_URL}/run-spatial-agent`, { room_id: roomId });

    res.json({ success: true, lotData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => console.log(`Zone-Draft agents-ts running on :${PORT}`));
