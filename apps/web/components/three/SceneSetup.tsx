'use client';

export default function SceneSetup() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 12, 8]} intensity={0.9} />
      <gridHelper args={[20, 20, '#1a1f2a', '#1a1f2a']} />
    </>
  );
}
