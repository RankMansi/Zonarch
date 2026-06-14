import { createTool, Agent } from '@mastra/core';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { geocodeNYCAddress } from '../tools/geocoder';
import { queryPLUTOByBBL } from '../tools/pluto-api';
import { bandRoom } from '../band/room';

const geocodeAndFetchPLUTO = createTool({
  id: 'geocode_and_fetch_pluto',
  description: 'Geocodes a NYC address and fetches full MapPLUTO data',
  inputSchema: z.object({ rawInput: z.string() }),
  outputSchema: z.object({
    bbl: z.string(),
    address: z.string(),
    borough: z.string(),
    zonedist1: z.string(),
    lot_area_sqft: z.number(),
    lot_depth: z.number(),
    lot_frontage: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    assessland: z.number(),
    yearbuilt: z.number(),
  }),
  execute: async ({ rawInput }) => {
    const geo = await geocodeNYCAddress(rawInput);
    const pluto = await queryPLUTOByBBL(geo.bbl);
    if (!pluto) throw new Error(`PLUTO: No record for BBL ${geo.bbl}`);
    return {
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
  },
});

const depositLotData = createTool({
  id: 'deposit_lot_data_to_band',
  description: 'Deposits geocoded lot data to the Band room',
  inputSchema: z.object({ roomId: z.string(), lotData: z.record(z.unknown()) }),
  execute: async ({ roomId, lotData }) => {
    await bandRoom.context.set(roomId, 'lot_data', lotData);
    return { success: true };
  },
});

export const intakeParser = new Agent({
  name: 'Intake Parser',
  instructions: `You are the Intake Parser for Zone-Draft. Geocode, validate PLUTO, deposit to Band room.`,
  model: google('gemini-1.5-flash'),
  tools: { geocodeAndFetchPLUTO, depositLotData },
});
