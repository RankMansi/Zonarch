'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import SceneSetup from './SceneSetup';
import BuildingEnvelope from './BuildingEnvelope';
import type { SessionStatus } from '@/types/zone-draft';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type LotData = NonNullable<ZoneDraftRoomSchema['lot_data']>;
type EnvelopeData = NonNullable<ZoneDraftRoomSchema['building_envelope']>;

interface BuildingSceneProps {
  envelopeData: EnvelopeData | null;
  lotData: LotData | null;
  status: SessionStatus;
  light?: boolean;
}

export function BuildingScene({ envelopeData, lotData, status, light = false }: BuildingSceneProps) {
  const heightFt = envelopeData?.total_height_ft;
  const floors = envelopeData?.floors_with_uap;

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ fov: 45, position: [12, 8, 12], near: 0.1, far: 1000 }}
        style={{
          background: light ? '#e8e0d4' : '#080c10',
          height: '100%',
          width: '100%',
        }}
      >
        <SceneSetup />
        <BuildingEnvelope envelopeData={envelopeData} lotData={lotData} status={status} />
        <OrbitControls enablePan enableZoom enableRotate autoRotate={false} />
      </Canvas>
      {heightFt && (
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-2 pointer-events-none">
          <span className="text-[10px] font-mono bg-white/90 text-[#6b4423] px-2 py-1 rounded-md border border-[#d4c4b0]">
            {heightFt.toFixed(0)} ft total · ~{floors ?? '?'} floors · bar = 10 ft
          </span>
        </div>
      )}
    </div>
  );
}
