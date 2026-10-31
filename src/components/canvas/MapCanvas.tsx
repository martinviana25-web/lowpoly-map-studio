import { MapControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MOUSE, Raycaster, Vector2 } from 'three';
import { raycastHeightfield, type Vec3 } from '../../core/raycast.ts';
import { useEditorStore } from '../../store/editorStore.ts';
import { BrushCursor } from './BrushCursor.tsx';
import { Props } from './Props.tsx';
import { Terrain } from './Terrain.tsx';
import { Water } from './Water.tsx';

const STROKE_INTERVAL = 1 / 30;

// El botón izquierdo queda libre para las herramientas.
const MOUSE_BUTTONS = { MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };

/** Traduce el puntero a acciones del store usando el picking propio del heightfield. */
function PointerTool() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const painting = useRef(false);
  const lastHit = useRef<Vec3 | null>(null);
  const sinceStroke = useRef(0);

  useEffect(() => {
    const element = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();

    const pick = (event: PointerEvent): Vec3 | null => {
      const box = element.getBoundingClientRect();
      ndc.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        -((event.clientY - box.top) / box.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const { origin, direction } = raycaster.ray;
      return raycastHeightfield(
        useEditorStore.getState().map,
        [origin.x, origin.y, origin.z],
        [direction.x, direction.y, direction.z],
      );
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const hit = pick(event);
      if (!hit) return;
      const store = useEditorStore.getState();
      if (store.tool === 'prop') store.placeProp(hit[0], hit[2]);
      else if (store.tool === 'erase') store.removeProp(hit[0], hit[2]);
      else {
        painting.current = true;
        lastHit.current = hit;
        sinceStroke.current = 0;
        store.beginStroke(hit[0], hit[2]);
      }
    };

    const onMove = (event: PointerEvent) => {
      const hit = pick(event);
      const store = useEditorStore.getState();
      store.setCursor(hit);
      if (!painting.current || !hit) return;
      lastHit.current = hit;
      // Pintar no acumula: se aplica en cada evento para no dejar huecos.
      if (store.tool === 'biome') store.strokeAt(hit[0], hit[2]);
    };

    const onUp = () => {
      if (!painting.current) return;
      painting.current = false;
      lastHit.current = null;
      useEditorStore.getState().endStroke();
    };

    const onLeave = () => {
      if (!painting.current) useEditorStore.getState().setCursor(null);
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gl, camera]);

  // Mantener apretado sigue elevando a ritmo fijo, sin depender de los FPS.
  useFrame((_, delta) => {
    const hit = lastHit.current;
    if (!painting.current || !hit) return;
    sinceStroke.current += delta;
    if (sinceStroke.current < STROKE_INTERVAL) return;
    sinceStroke.current = 0;
    useEditorStore.getState().strokeAt(hit[0], hit[2]);
  });

  return null;
}

/** Reencuadra la cámara cuando cambia el tamaño del mapa. */
function CameraRig({ width, depth }: { width: number; depth: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const span = Math.max(width, depth);
    camera.position.set(width / 2, span * 0.7, depth / 2 + span * 0.8);
    camera.lookAt(width / 2, 0, depth / 2);
  }, [camera, width, depth]);
  return null;
}

export function MapCanvas() {
  const width = useEditorStore((s) => s.map.width);
  const depth = useEditorStore((s) => s.map.depth);
  const target = useMemo(
    () => [width / 2, 0, depth / 2] as [number, number, number],
    [width, depth],
  );

  return (
    <Canvas dpr={[1, 1.5]} camera={{ fov: 50, near: 0.5, far: 3000 }}>
      <color attach="background" args={[0x12151b]} />
      <hemisphereLight args={[0xdfeaff, 0x4a4436, 1.1]} />
      <directionalLight position={[80, 140, 40]} intensity={2.2} />
      <Terrain />
      <Water />
      <Props />
      <BrushCursor />
      <PointerTool />
      <CameraRig width={width} depth={depth} />
      <MapControls
        makeDefault
        target={target}
        mouseButtons={MOUSE_BUTTONS}
        screenSpacePanning={false}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={6}
        maxDistance={600}
      />
    </Canvas>
  );
}
