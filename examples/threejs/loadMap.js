// Reconstruye un mapa de LowPoly Map Studio en Three.js.
// ESM standalone: copiá este archivo a tu proyecto; solo depende de `three`.
import * as THREE from 'three';

const BIOME_COLORS = {
  pasto: 0x6fae4f,
  arena: 0xdcc98a,
  roca: 0x8a8580,
  pantano: 0x5a6b3c,
  nieve: 0xf0f3f7,
  agua: 0x2f6f9f,
};

function buildTerrain(data) {
  const { width, depth } = data.metadata;
  const { heights, biomes, biomePalette } = data.terrain;
  const stride = width + 1;
  const palette = biomePalette.map((key) => new THREE.Color(BIOME_COLORS[key] ?? 0xff00ff));

  const position = new Float32Array(width * depth * 18);
  const color = new Float32Array(width * depth * 18);
  let p = 0;
  let c = 0;
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const a = heights[z * stride + x];
      const b = heights[z * stride + x + 1];
      const d = heights[(z + 1) * stride + x];
      const e = heights[(z + 1) * stride + x + 1];
      const corners = [
        x, a, z,
        x, d, z + 1,
        x + 1, b, z,
        x + 1, b, z,
        x, d, z + 1,
        x + 1, e, z + 1,
      ];
      position.set(corners, p);
      p += 18;
      const tint = palette[biomes[z * width + x]];
      for (let v = 0; v < 6; v++, c += 3) tint.toArray(color, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  return mesh;
}

function buildWater(data) {
  const position = new Float32Array(data.water.length * 18);
  data.water.forEach(([x, z, y], i) => {
    position.set(
      [x, y, z, x, y, z + 1, x + 1, y, z, x + 1, y, z, x, y, z + 1, x + 1, y, z + 1],
      i * 18,
    );
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  const material = new THREE.MeshStandardMaterial({
    color: 0x3b8fc4,
    transparent: true,
    opacity: 0.65,
    flatShading: true, // la geometría no trae normales
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'water';
  return mesh;
}

function buildInstances(asset, props, resolve) {
  const { geometry, material } = resolve(asset);
  const mesh = new THREE.InstancedMesh(geometry, material, props.length);
  mesh.name = asset;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  props.forEach((prop, i) => {
    position.fromArray(prop.position);
    quaternion.setFromAxisAngle(up, prop.rotationY);
    scale.setScalar(prop.scale);
    mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function placeholder() {
  const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  return { geometry, material: new THREE.MeshStandardMaterial({ color: 0xff9f1c }) };
}

/**
 * Construye el mapa a partir del JSON ya parseado.
 * @param {object} data Contenido de un mapa exportado (schema versión 1).
 * @param {{ resolveAsset?: (asset: string) => { geometry: THREE.BufferGeometry, material: THREE.Material } }} [options]
 *   `resolveAsset` devuelve la malla de cada asset; por defecto, una caja.
 * @returns {{ group: THREE.Group, terrain: THREE.Mesh, water: THREE.Mesh | null, instances: Map<string, THREE.InstancedMesh> }}
 */
export function loadMap(data, options = {}) {
  if (data.version !== 1) throw new Error(`Versión de mapa no soportada: ${data.version}`);
  const resolve = options.resolveAsset ?? placeholder;

  const group = new THREE.Group();
  group.name = data.metadata.name;

  const terrain = buildTerrain(data);
  group.add(terrain);

  const water = data.water.length > 0 ? buildWater(data) : null;
  if (water) group.add(water);

  const byAsset = Map.groupBy(data.props, (prop) => prop.asset);
  const instances = new Map();
  for (const [asset, props] of byAsset) {
    const mesh = buildInstances(asset, props, resolve);
    instances.set(asset, mesh);
    group.add(mesh);
  }
  return { group, terrain, water, instances };
}

/** Descarga el JSON y construye el mapa. */
export async function loadMapFromUrl(url, options) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo leer ${url}: ${response.status}`);
  return loadMap(await response.json(), options);
}
