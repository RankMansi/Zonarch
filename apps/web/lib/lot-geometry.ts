/** Approximate lot footprint as lat/lng polygon from center + dimensions (feet). */
export function approximateLotPolygon(
  lat: number,
  lng: number,
  frontageFt: number,
  depthFt: number
): Array<[number, number]> {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const halfDepth = (depthFt * 0.3048) / 2;
  const halfFront = (frontageFt * 0.3048) / 2;
  const dLat = halfDepth / mPerDegLat;
  const dLng = halfFront / mPerDegLng;
  return [
    [lat - dLat, lng - dLng],
    [lat - dLat, lng + dLng],
    [lat + dLat, lng + dLng],
    [lat + dLat, lng - dLng],
  ];
}

export function polygonFromPlutoGeom(
  geom?: { type: string; coordinates: number[][][] }
): Array<[number, number]> | undefined {
  if (!geom?.coordinates?.[0]?.length) return undefined;
  return geom.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
}
