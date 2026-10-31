import { useEffect, useLayoutEffect, useMemo } from 'react';
import { createTerrainGeometry, updateTerrainRange } from '../../core/terrainMesh.ts';
import { useEditorStore } from '../../store/editorStore.ts';

export function Terrain() {
  const map = useEditorStore((s) => s.map);
  const revision = useEditorStore((s) => s.terrainRevision);
  const geometry = useMemo(() => createTerrainGeometry(map), [map]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const rect = useEditorStore.getState().consumeDirtyRect();
    if (rect) updateTerrainRange(geometry, map, rect);
  }, [revision, geometry, map]);

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}
