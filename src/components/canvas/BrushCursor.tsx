import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, type LineLoop } from 'three';
import { sampleHeight } from '../../core/heightmap.ts';
import { PICK_RADIUS, isBrushTool, useEditorStore } from '../../store/editorStore.ts';

const SEGMENTS = 64;
const LIFT = 0.08;

/** Anillo que copia el relieve bajo el puntero, con el radio de la herramienta. */
export function BrushCursor() {
  const ref = useRef<LineLoop>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(SEGMENTS * 3), 3));
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const line = ref.current;
    if (!line) return;
    const { cursor, map, tool, brush } = useEditorStore.getState();
    line.visible = cursor !== null;
    if (!cursor) return;

    const radius = isBrushTool(tool) ? brush.radius : tool === 'erase' ? PICK_RADIUS : 0.5;
    const position = geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const x = cursor[0] + Math.cos(angle) * radius;
      const z = cursor[2] + Math.sin(angle) * radius;
      position.setXYZ(i, x, sampleHeight(map, x, z) + LIFT, z);
    }
    position.needsUpdate = true;
  });

  return (
    <lineLoop ref={ref} geometry={geometry} frustumCulled={false} visible={false}>
      <lineBasicMaterial color={0xffffff} depthTest={false} transparent />
    </lineLoop>
  );
}
