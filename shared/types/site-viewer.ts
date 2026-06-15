export type SiteViewerLayerId =
  | 'lot_boundary'
  | 'buildable_footprint'
  | 'envelope_uap'
  | 'envelope_base'
  | 'existing_building'
  | 'sky_exposure_plane'
  | 'subject_building';

export interface SiteViewerFeatureProperties {
  layer: SiteViewerLayerId;
  bbl?: string;
  height_ft?: number;
  extrusion_base_ft?: number;
  floors?: number;
  gfa_sqft?: number;
  label?: string;
}

export interface SiteViewerGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: SiteViewerFeatureProperties;
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  }>;
}

export interface SiteViewerPayload {
  sessionId: string;
  address: string;
  bbl: string;
  zonedist1: string;
  center: { lat: number; lng: number };
  bbox: [number, number, number, number];
  camera: { zoom: number; pitch: number; bearing: number };
  metrics: {
    height_ft: number;
    floors: number;
    gfa_sqft: number;
    verdict?: string;
    base_far: number;
    uap_far: number;
    sky_exposure_base_ft: number;
  };
  layers: SiteViewerGeoJSON;
  meta: {
    existing_building_count: number;
    envelope_method: 'polygon' | 'rectangle_fallback';
    data_warnings: string[];
    use_osm_buildings_fallback?: boolean;
  };
}
