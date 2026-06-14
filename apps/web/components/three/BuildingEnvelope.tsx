'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import type { SessionStatus } from '@/types/zone-draft';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;
type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;

interface BuildingEnvelopeProps {
  envelopeData: EnvelopeData | null;
  lotData: LotData | null;
  status: SessionStatus;
}

type Vertex = { x: number; y: number; z: number };

function groupByElevation(vertices: Vertex[]): Vertex[][] {
  const buckets = new Map<number, Vertex[]>();
  for (const v of vertices) {
    const key = Math.round(v.y * 1000);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(v);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, verts]) => verts);
}

function ringFromLayer(verts: Vertex[]): THREE.Vector2[] {
  const xs = verts.map((v) => v.x);
  const zs = verts.map((v) => v.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return [
    new THREE.Vector2(minX, minZ),
    new THREE.Vector2(maxX, minZ),
    new THREE.Vector2(maxX, maxZ),
    new THREE.Vector2(minX, maxZ),
  ];
}

function buildTierGeometry(lower: Vertex[], upper: Vertex[]): THREE.BufferGeometry {
  const lowerRing = ringFromLayer(lower);
  const upperRing = ringFromLayer(upper);
  const y0 = lower[0]?.y ?? 0;
  const y1 = upper[0]?.y ?? y0;

  const positions: number[] = [];
  const indices: number[] = [];

  for (const ring of [lowerRing, upperRing]) {
    for (const p of ring) positions.push(p.x, 0, p.y);
  }
  const baseIdx = 0;
  const topIdx = 4;

  const addQuad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };

  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    addQuad(baseIdx + i, baseIdx + next, topIdx + next, topIdx + i);
  }

  positions[1] = y0;
  positions[4] = y0;
  positions[7] = y0;
  positions[10] = y0;
  positions[13] = y1;
  positions[16] = y1;
  positions[19] = y1;
  positions[22] = y1;

  for (let i = 0; i < 4; i++) {
    positions[i * 3 + 1] = y0;
    positions[(4 + i) * 3 + 1] = y1;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function getDimensions(envelopeData: EnvelopeData | null, lotData: LotData | null) {
  if (envelopeData?.envelope_vertices?.length) {
    const verts = envelopeData.envelope_vertices;
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    const zs = verts.map((v) => v.z);
    return {
      width: Math.max(...xs) - Math.min(...xs) || 1,
      depth: Math.max(...zs) - Math.min(...zs) || 1,
      height: Math.max(...ys) || 0.1,
    };
  }
  if (lotData) {
    const sfToM = 0.3048;
    return {
      width: lotData.lot_frontage * sfToM || 1,
      depth: Math.max((lotData.lot_depth - 30) * sfToM, 0.5) || 1,
      height: 0.05,
    };
  }
  return { width: 1, depth: 1, height: 0.05 };
}

export default function BuildingEnvelope({
  envelopeData,
  lotData,
  status,
}: BuildingEnvelopeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const dims = getDimensions(envelopeData, lotData);
  const targetHeight = dims.height;
  const [animatedHeight, setAnimatedHeight] = useState(0.05);
  const wireColor = status === 'complete' ? '#2e7d32' : '#8b5a2b';

  const tiers = useMemo(() => {
    const verts = envelopeData?.envelope_vertices;
    if (!verts || verts.length < 8) return null;
    const layers = groupByElevation(verts);
    if (layers.length < 2) return null;
    const result: THREE.BufferGeometry[] = [];
    for (let i = 0; i < layers.length - 1; i++) {
      result.push(buildTierGeometry(layers[i], layers[i + 1]));
    }
    return result;
  }, [envelopeData]);

  useEffect(() => {
    let frame: number;
    const start = animatedHeight;
    const startTime = performance.now();
    const duration = 1200;

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedHeight(start + (targetHeight - start) * eased);
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetHeight]);

  const scaleFactor = targetHeight > 0 ? animatedHeight / targetHeight : 0;

  return (
    <group position={[-dims.width / 2, 0, -dims.depth / 2]}>
      {tiers ? (
        tiers.map((geom, i) => (
          <group key={i} scale={[1, scaleFactor, 1]}>
            <mesh geometry={geom} position={[dims.width / 2, 0, dims.depth / 2]}>
              <meshLambertMaterial color="#3d4f5f" transparent opacity={0.75} />
            </mesh>
            <mesh geometry={geom} position={[dims.width / 2, 0, dims.depth / 2]}>
              <meshBasicMaterial wireframe color={wireColor} />
            </mesh>
          </group>
        ))
      ) : (
        <mesh ref={meshRef} position={[dims.width / 2, animatedHeight / 2, dims.depth / 2]}>
          <boxGeometry args={[dims.width, animatedHeight, dims.depth]} />
          <meshLambertMaterial color="#3d4f5f" transparent opacity={0.7} />
        </mesh>
      )}

      {envelopeData?.setback_planes?.map((plane, i) => (
        <mesh
          key={i}
          position={[dims.width / 2, plane.elevation_ft * 0.3048 * scaleFactor, dims.depth / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[dims.width, dims.depth]} />
          <meshBasicMaterial color="#c8956c" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Scale reference: ~10 ft floor marker */}
      <mesh position={[dims.width + 0.3, 3.05 * scaleFactor, dims.depth / 2]}>
        <boxGeometry args={[0.08, 3.05, 0.08]} />
        <meshBasicMaterial color="#6b4423" />
      </mesh>
    </group>
  );
}
