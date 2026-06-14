export type BoroughCode = 'MN' | 'BX' | 'BK' | 'QN' | 'SI';

export interface PLUTORecord {
  bbl: string;
  address: string;
  borough: BoroughCode;
  block: string;
  lot: string;
  zonedist1: string;
  zonedist2?: string;
  overlay1?: string;
  lotarea: string;
  lotdepth: string;
  lotfront: string;
  latitude: string;
  longitude: string;
  assessland: string;
  yearbuilt: string;
  ownername?: string;
  assesstot?: string;
  bldgarea?: string;
  unitsres?: string;
  unitstotal?: string;
  the_geom?: { type: string; coordinates: number[][][] };
}

export interface GeoSearchResult {
  label: string;
  borough: string;
  bbl: string;
  streetAddress?: string;
  latitude: number;
  longitude: number;
  confidence: number;
}

export interface SalesComp {
  address: string;
  sale_price: string;
  gross_square_feet: string;
  sale_date: string;
  building_class_category: string;
  neighborhood: string;
}

export interface UnderwritingSession {
  id: string;
  created_at: string;
  raw_input: string;
  band_room_id: string | null;
  status: string;
}

export type SessionStatus = 'idle' | 'running' | 'complete' | 'failed';

export interface TerminalMessage {
  id: string;
  type: string;
  agent?: string;
  content?: string;
  timestamp: number;
}
