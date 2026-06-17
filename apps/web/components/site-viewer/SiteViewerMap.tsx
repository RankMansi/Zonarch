'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Map, { Layer, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { SiteViewerGeoJSON, SiteViewerPayload } from '@/types/zone-draft';
import type { LayerVisibility } from './LayerPanel';
import type { FilterSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const OSM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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

function layerFilter(layerId: string): FilterSpecification {
  return ['==', ['get', 'layer'], layerId];
}

interface SiteViewerMapProps {
  payload: SiteViewerPayload;
  visibility: LayerVisibility;
}

export default function SiteViewerMap({ payload, visibility }: SiteViewerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const flewRef = useRef(false);

  const mapStyle = payload.meta.use_osm_buildings_fallback ? OSM_STYLE : CARTO_STYLE;

  const geojson = useMemo(
    () => payload.layers as SiteViewerGeoJSON,
    [payload.layers]
  );

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

  useEffect(() => {
    if (flewRef.current) return;
    const map = mapRef.current?.getMap();
    if (!map?.isStyleLoaded()) return;
    flewRef.current = true;
    flyToLot();
  }, [flyToLot]);

  const vis = (on: boolean): 'visible' | 'none' => (on ? 'visible' : 'none');

  return (
    <div className="site-viewer-map relative flex-1 min-h-0 min-w-0">
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{
          longitude: payload.center.lng,
          latitude: payload.center.lat,
          zoom: payload.camera.zoom - 0.5,
          pitch: payload.camera.pitch,
          bearing: payload.camera.bearing,
        }}
        maxPitch={85}
        style={{ width: '100%', height: '100%' }}
        onLoad={flyToLot}
      >
        <NavigationControl position="top-left" visualizePitch />

        <Source id="site-viewer-geo" type="geojson" data={geojson}>
          {/* Lot boundary */}
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

          {/* Existing + subject buildings */}
          <Layer
            id="existing-buildings"
            type="fill-extrusion"
            filter={layerFilter('existing_building')}
            layout={{ visibility: vis(visibility.existing_buildings) }}
            paint={{
              'fill-extrusion-color': '#b8a898',
              'fill-extrusion-height': FT_TO_M,
              'fill-extrusion-base': BASE_FT_TO_M,
              'fill-extrusion-opacity': 0.85,
            }}
          />
          <Layer
            id="subject-building"
            type="fill-extrusion"
            filter={layerFilter('subject_building')}
            layout={{ visibility: vis(visibility.existing_buildings) }}
            paint={{
              'fill-extrusion-color': '#5c4033',
              'fill-extrusion-height': FT_TO_M,
              'fill-extrusion-base': BASE_FT_TO_M,
              'fill-extrusion-opacity': 0.9,
            }}
          />

          {/* UAP envelope */}
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

          {/* Base FAR envelope */}
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

          {/* Sky exposure plane */}
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
