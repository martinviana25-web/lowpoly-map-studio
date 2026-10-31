import { Clone, useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { PROP_CATALOG, createPieceGeometry, type PropPiece } from '../../core/propCatalog.ts';
import type { PropInstance } from '../../core/types.ts';
import { useEditorStore, type ExternalAsset } from '../../store/editorStore.ts';

/** Se usa para assets ausentes, cargando o con error. */
const PLACEHOLDER: PropPiece = {
  shape: { type: 'box', size: [1, 1, 1] },
  offset: [0, 0.5, 0],
  color: 0xff9f1c,
};

function InstancedPiece({ piece, props }: { piece: PropPiece; props: PropInstance[] }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => createPieceGeometry(piece), [piece]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();
    props.forEach((prop, i) => {
      position.fromArray(prop.position);
      rotation.setFromEuler(euler.set(0, prop.rotationY, 0));
      scale.setScalar(prop.scale);
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [props]);

  return (
    <instancedMesh
      key={props.length}
      ref={ref}
      args={[geometry, undefined, props.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial color={piece.color} flatShading roughness={0.9} />
    </instancedMesh>
  );
}

function ExternalInstances({ asset, props }: { asset: ExternalAsset; props: PropInstance[] }) {
  // Sin Draco: drei bajaría el decoder de un CDN externo.
  const { scene } = useGLTF(asset.url, false);
  return props.map((prop, i) => (
    <Clone
      key={i}
      object={scene}
      position={prop.position}
      rotation={[0, prop.rotationY, 0]}
      scale={prop.scale}
    />
  ));
}

interface BoundaryProps {
  assetId: string;
  fallback: ReactNode;
  children: ReactNode;
}

/** Si el GLB no se puede leer, muestra la caja y avisa en el panel; nunca rompe el canvas. */
class AssetBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    useEditorStore.getState().setAssetError(this.props.assetId, error.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function groupByAsset(props: PropInstance[]): Map<string, PropInstance[]> {
  const groups = new Map<string, PropInstance[]>();
  for (const prop of props) {
    const group = groups.get(prop.asset);
    if (group) group.push(prop);
    else groups.set(prop.asset, [prop]);
  }
  return groups;
}

export function Props() {
  const map = useEditorStore((s) => s.map);
  const revision = useEditorStore((s) => s.propsRevision);
  const assets = useEditorStore((s) => s.assets);
  const groups = useMemo(() => groupByAsset(map.props), [map, revision]);

  const catalogIds = new Set(PROP_CATALOG.map((def) => def.id));
  const others = [...groups].filter(([id]) => !catalogIds.has(id));

  return (
    <>
      {PROP_CATALOG.flatMap((def) => {
        const props = groups.get(def.id);
        if (!props) return [];
        return def.pieces.map((piece, i) => (
          <InstancedPiece key={`${def.id}-${i}`} piece={piece} props={props} />
        ));
      })}
      {others.map(([id, props]) => {
        const asset = assets.find((a) => a.id === id);
        const placeholder = <InstancedPiece piece={PLACEHOLDER} props={props} />;
        if (!asset) return <group key={id}>{placeholder}</group>;
        return (
          <AssetBoundary key={asset.url} assetId={id} fallback={placeholder}>
            <Suspense fallback={placeholder}>
              <ExternalInstances asset={asset} props={props} />
            </Suspense>
          </AssetBoundary>
        );
      })}
    </>
  );
}
