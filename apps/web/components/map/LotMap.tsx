'use client';

import { MapContainer, TileLayer, Polygon, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;

interface LotMapProps {
  lotData: LotData | null;
  light?: boolean;
  height?: number;
}

const NYC_CENTER: [number, number] = [40.748, -73.937];

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 400);
    window.addEventListener('resize', fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

function FitBounds({ coords }: { coords: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length >= 3) {
      map.fitBounds(coords, { padding: [20, 20], maxZoom: 18 });
    } else if (coords.length === 1) {
      map.setView(coords[0], 17);
    }
  }, [coords, map]);
  return null;
}

function lotPinIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;background:#6b4423;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function LotMap({ lotData, light = true, height = 200 }: LotMapProps) {
  if (!lotData) {
    return (
      <div className="lot-map-shell lot-map-placeholder" style={{ height }}>
        <p className="lot-map-empty-static">Look up a site to see the map.</p>
      </div>
    );
  }

  const hasCoords =
    Number.isFinite(lotData.latitude) &&
    Number.isFinite(lotData.longitude) &&
    lotData.latitude !== 0;

  const center: [number, number] = hasCoords
    ? [lotData.latitude, lotData.longitude]
    : NYC_CENTER;

  const polygon = lotData.lot_polygon_coords;
  const mapKey = `${lotData.bbl}-${height}`;

  if (!hasCoords) {
    return (
      <div className="lot-map-shell lot-map-placeholder" style={{ height }}>
        <p className="lot-map-empty-static">No map coordinates for BBL {lotData.bbl}.</p>
      </div>
    );
  }

  return (
    <div className="lot-map-shell" style={{ height }} data-light={light ? '1' : '0'}>
      <MapContainer
        key={mapKey}
        center={center}
        zoom={17}
        scrollWheelZoom={false}
        zoomControl
        className="lot-map-container"
      >
        <MapResizeFix />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {hasCoords && (
          <>
            <Marker position={center} icon={lotPinIcon()} />
            <FitBounds coords={polygon && polygon.length >= 3 ? polygon : [center]} />
          </>
        )}
        {polygon && polygon.length >= 3 && (
          <Polygon
            positions={polygon}
            pathOptions={{
              color: '#6b4423',
              fillColor: '#8b5a2b',
              fillOpacity: 0.3,
              weight: 2,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
