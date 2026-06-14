import type { GeoSearchResult } from '@/types/zone-draft';
import { geocodeNYCAddress } from './tools/geocoder';
import { parseLotData, resolvePLUTO } from './tools/pluto-api';
import { parseSiteInput } from './parse-site-input';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;

export interface SitePreview {
  rawInput: string;
  inputKind: 'bbl' | 'address';
  geo: GeoSearchResult;
  lotData: LotData;
  warnings: string[];
}

export async function resolveSitePreview(rawInput: string): Promise<SitePreview> {
  const parsed = parseSiteInput(rawInput);
  const warnings: string[] = [];

  const geo = await geocodeNYCAddress(parsed.raw);

  if (parsed.kind === 'address' && geo.confidence < 0.8) {
    warnings.push(
      `Geocoder confidence is ${(geo.confidence * 100).toFixed(0)}% — confirm BBL ${geo.bbl} matches your intended lot.`
    );
  }

  const pluto = await resolvePLUTO(geo);
  const lotData = {
    ...parseLotData(pluto, geo),
    geocode_confidence: geo.confidence,
    geocode_label: geo.label,
    input_raw: parsed.raw,
    input_kind: parsed.kind,
  };

  if (parsed.kind === 'bbl' && parsed.bbl && lotData.bbl !== normalizeBBL(parsed.bbl)) {
    warnings.push(`Requested BBL ${parsed.bbl} resolved to PLUTO record ${lotData.bbl}.`);
  }

  if (pluto.address && geo.label && !geo.label.toUpperCase().includes(pluto.address.split(' ')[0])) {
    warnings.push(`PLUTO address "${pluto.address}" may differ from your search "${parsed.raw}".`);
  }

  return { rawInput: parsed.raw, inputKind: parsed.kind, geo, lotData, warnings };
}

function normalizeBBL(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(0, 10) : digits.padStart(10, '0');
}
