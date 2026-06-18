'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Map, { Layer, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { SiteViewerGeoJSON, SiteViewerPayload } from '@/types/zone-draft';
import type { LayerVisibility } from './LayerPanel';
import type { FilterSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const CITY_BUILDINGS_SOURCE = 'openfreemap';
const CITY_BUILDINGS_LAYER = 'city-3d-buildings';

const FT_TO_M: ['*', ['coalesce', ['get', 'height_ft'], number], number] = [
  '*',
  ['coalesce', ['get', 'height_ft'], 30],
  0.3048,
];

const BASE_FT_TO_M: ['*', ['coalesce', ['get', 'extrusion_base_ft'], number], number] = [
  '*',
  ['coalesce', ['get', 'extrusion_base_ft'], 0],
  0.3048,
];

const OVERLAY_LAYERS = new Set([
  'lot_boundary',
  'buildable_footprint',
  'envelope_uap',
  'envelope_base',
  'sky_exposure_plane',
]);

function layerFilter(layerId: string): FilterSpecification {
  return ['==', ['get', 'layer'], layerId];
}

function findFirstSymbolLayerId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  for (const layer of layers) {
    if (layer.type === 'symbol') return layer.id;
  }
  return undefined;
}

function setupCityBuildingsLayer(map: MapLibreMap): void {
  if (map.getLayer(CITY_BUILDINGS_LAYER)) return;

  if (!map.getSource(CITY_BUILDINGS_SOURCE)) {
    map.addSource(CITY_BUILDINGS_SOURCE, {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
  }

  const beforeId = findFirstSymbolLayerId(map);

  map.addLayer(
    {
      id: CITY_BUILDINGS_LAYER,
      source: CITY_BUILDINGS_SOURCE,
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 15,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color': '#c8bcb0',
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          16,
          ['coalesce', ['get', 'render_height'], ['get', 'height'], 12],
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    },
    beforeId
  );
}

interface SiteViewerMapProps {
  payload: SiteViewerPayload;
  visibility: LayerVisibility;
}

export default function SiteViewerMap({ payload, visibility }: SiteViewerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const flewRef = useRef(false);
  const cityLayerReadyRef = useRef(false);

  const geojson = useMemo(() => {
    const all = payload.layers as SiteViewerGeoJSON;
    return {
      type: 'FeatureCollection' as const,
      features: all.features.filter((f) => OVERLAY_LAYERS.has(f.properties.layer)),
    };
  }, [payload.layers]);

  const flyToLot = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({
      center: [payload.center.lng, payload.center.lat],
      zoom: payload.camera.zoom,
      pitch: payload.camera.pitch,
      bearing: payload.camera.bearing,
      duration: 2000,
    });
  }, [payload]);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const init = () => {
      try {
        setupCityBuildingsLayer(map);
        cityLayerReadyRef.current = true;
        map.setLayoutProperty(
          CITY_BUILDINGS_LAYER,
          'visibility',
          visibility.city_buildings ? 'visible' : 'none'
        );
      } catch (err) {
        console.warn('[site-viewer] city buildings layer:', err);
      }
      if (!flewRef.current) {
        flewRef.current = true;
        flyToLot();
      }
    };

    if (map.isStyleLoaded()) init();
    else map.once('styledata', init);
  }, [flyToLot, visibility.city_buildings]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !cityLayerReadyRef.current || !map.getLayer(CITY_BUILDINGS_LAYER)) return;
    map.setLayoutProperty(
      CITY_BUILDINGS_LAYER,
      'visibility',
      visibility.city_buildings ? 'visible' : 'none'
    );
  }, [visibility.city_buildings]);

  const vis = (on: boolean): 'visible' | 'none' => (on ? 'visible' : 'none');

  return (
    <div className="site-viewer-map relative flex-1 min-h-0 min-w-0">
      <Map
        ref={mapRef}
        mapStyle={OPENFREEMAP_STYLE}
        initialViewState={{
          longitude: payload.center.lng,
          latitude: payload.center.lat,
          zoom: payload.camera.zoom - 0.5,
          pitch: payload.camera.pitch,
          bearing: payload.camera.bearing,
        }}
        maxPitch={85}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleMapLoad}
      >
        <NavigationControl position="top-left" visualizePitch />

        <Source id="site-viewer-geo" type="geojson" data={geojson}>
          <Layer
            id="lot-fill"
            type="fill"
            filter={layerFilter('lot_boundary')}
            layout={{ visibility: vis(visibility.lot_boundary) }}
            paint={{ 'fill-color': '#6b4423', 'fill-opacity': 0.15 }}
          />
          <Layer
            id="lot-outline"
            type="line"
            filter={layerFilter('lot_boundary')}
            layout={{ visibility: vis(visibility.lot_boundary) }}
            paint={{ 'line-color': '#6b4423', 'line-width': 3 }}
          />
          <Layer
            id="lot-pad"
            type="fill-extrusion"
            filter={layerFilter('lot_boundary')}
            layout={{ visibility: vis(visibility.lot_boundary) }}
            paint={{
              'fill-extrusion-color': '#6b4423',
              'fill-extrusion-height': ['*', 2, 0.3048],
              'fill-extrusion-opacity': 0.2,
            }}
          />

          <Layer
            id="envelope-uap"
            type="fill-extrusion"
            filter={layerFilter('envelope_uap')}
            layout={{ visibility: vis(visibility.envelope_uap) }}
            paint={{
              'fill-extrusion-color': '#2e7d32',
              'fill-extrusion-height': FT_TO_M,
              'fill-extrusion-base': BASE_FT_TO_M,
              'fill-extrusion-opacity': 0.55,
            }}
          />

          <Layer
            id="envelope-base"
            type="fill-extrusion"
            filter={layerFilter('envelope_base')}
            layout={{ visibility: vis(visibility.envelope_base) }}
            paint={{
              'fill-extrusion-color': '#8b5a2b',
              'fill-extrusion-height': FT_TO_M,
              'fill-extrusion-base': BASE_FT_TO_M,
              'fill-extrusion-opacity': 0.4,
            }}
          />

          <Layer
            id="sky-plane"
            type="fill-extrusion"
            filter={layerFilter('sky_exposure_plane')}
            layout={{ visibility: vis(visibility.sky_exposure_plane) }}
            paint={{
              'fill-extrusion-color': '#c8956c',
              'fill-extrusion-height': FT_TO_M,
              'fill-extrusion-base': BASE_FT_TO_M,
              'fill-extrusion-opacity': 0.25,
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
