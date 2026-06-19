import type { SiteViewerGeoJSON } from './site-viewer';

export interface ZoneDraftRoomSchema {
  lot_data: {
    bbl: string;
    address: string;
    borough: 'MN' | 'BX' | 'BK' | 'QN' | 'SI';
    block: string;
    lot: string;
    zonedist1: string;
    zonedist2?: string;
    overlay1?: string;
    lot_area_sqft: number;
    lot_depth: number;
    lot_frontage: number;
    latitude: number;
    longitude: number;
    lot_polygon_wkt?: string;
    lot_polygon_coords?: Array<[number, number]>;
    assessland: number;
    yearbuilt: number;
    neighborhood?: string;
    geocode_confidence?: number;
    geocode_label?: string;
    input_raw?: string;
    input_kind?: 'bbl' | 'address';
  } | null;

  zoning_analysis: {
    base_far: number;
    uap_far: number;
    max_height_ft: number | null;
    sky_exposure_base_ft: number;
    sky_exposure_angle: number;
    rear_yard_ft: number;
    min_front_setback_ft: number;
    max_lot_coverage_pct: number;
    parking_required: boolean;
    uap_eligible: boolean;
    uap_affordable_pct: number;
    applicable_zr_sections: string[];
    city_of_yes_notes: string;
    rag_sources: string[];
    zoning_table_key?: string;
    zoning_approximated?: boolean;
  } | null;

  building_envelope: {
    max_residential_sqft: number;
    max_commercial_sqft: number;
    gross_floor_area: number;
    envelope_vertices: Array<{ x: number; y: number; z: number }>;
    floors_standard: number;
    floors_with_uap: number;
    total_height_ft?: number;
    setback_planes: Array<{
      elevation_ft: number;
      setback_depth_ft: number;
      face: 'north' | 'south' | 'east' | 'west';
    }>;
    violation_log: Array<{
      type: string;
      description: string;
      resolution: string;
    }>;
    iteration_count: number;
  } | null;

  financial_analysis: {
    comp_avg_psf: number;
    comp_count: number;
    comp_addresses: string[];
    projected_asset_value: number;
    hard_cost_psf: number;
    hard_cost_total: number;
    soft_cost_total: number;
    financing_cost: number;
    developer_profit: number;
    total_project_cost: number;
    residual_land_value: number;
    cap_rate: number;
    irr_estimate: number;
    deal_verdict: 'STRONG BUY' | 'BUY' | 'HOLD' | 'PASS';
    verdict_rationale: string;
    comp_default_used?: boolean;
    assessed_land_estimate?: number;
    assessed_land_multiplier?: number;
  } | null;

  /** Georeferenced Site Viewer layers (optional cache after spatial agent) */
  site_geometry_geojson?: SiteViewerGeoJSON | null;

  /** Last executive brief sent via Resend (user-triggered after APPROVED) */
  outbound_email: {
    resend_id: string;
    recipients: string[];
    sent_at: string;
    subject: string;
  } | null;

  status: 'PENDING' | 'RUNNING' | 'APPROVED' | 'FAILED';
  iteration_count: number;
  error_log: string[];
}

export type BandEvent = {
  event: string;
  sessionId?: string;
  rawInput?: string;
  agent?: string;
  content?: string;
  error?: string;
  status?: string;
  [key: string]: unknown;
};
