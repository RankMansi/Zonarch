export type SiteViewerLayerId =
  | 'lot_boundary'
  | 'buildable_footprint'
  | 'envelope_uap'
  | 'envelope_base'
  | 'sky_exposure_plane';

export type TaxLotSource = 'zoning_api' | 'mappluto_arcgis' | 'stored_pluto' | 'rectangle_fallback';

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
    envelope_method: 'polygon' | 'rectangle_fallback';
    lot_polygon_source?: TaxLotSource;
    data_warnings: string[];
    map_engine: 'openfreemap_maplibre';
  };
}
