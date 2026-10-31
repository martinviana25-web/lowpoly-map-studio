import { useEffect, useMemo } from 'react';
import { createWaterGeometry } from '../../core/terrainMesh.ts';
import { useEditorStore } from '../../store/editorStore.ts';

export function Water() {
  const map = useEditorStore((s) => s.map);
  const revision = useEditorStore((s) => s.waterRevision);
  const geometry = useMemo(() => createWaterGeometry(map), [map, revision]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshStandardMaterial
        color={0x3b8fc4}
        transparent
        opacity={0.65}
        flatShading
        roughness={0.3}
        depthWrite={false}
      />
    </mesh>
  );
}
