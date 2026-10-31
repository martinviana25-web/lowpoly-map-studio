import { BufferAttribute, BufferGeometry } from 'three';
import { BIOME_LINEAR } from './biomes.ts';
import { cellIndex, vertexIndex, type CellRect, type MapData } from './types.ts';

const VERTS_PER_CELL = 6;
const FLOATS_PER_CELL = VERTS_PER_CELL * 3;

/** Variación por celda determinista, para el facetado low-poly. */
function cellShade(cell: number): number {
  const hash = Math.imul(cell + 1, 2654435761) >>> 24;
  return 0.92 + (hash / 255) * 0.16;
}

function writeCell(
  map: MapData,
  x: number,
  z: number,
  position: Float32Array,
  color: Float32Array,
): void {
  const c = cellIndex(map, x, z);
  const base = c * FLOATS_PER_CELL;
  const ha = map.heights[vertexIndex(map, x, z)];
  const hb = map.heights[vertexIndex(map, x + 1, z)];
  const hc = map.heights[vertexIndex(map, x, z + 1)];
  const hd = map.heights[vertexIndex(map, x + 1, z + 1)];

  // Triángulos a-c-b y b-c-d, antihorarios vistos desde arriba.
  position[base] = x;
  position[base + 1] = ha;
  position[base + 2] = z;
  position[base + 3] = x;
  position[base + 4] = hc;
  position[base + 5] = z + 1;
  position[base + 6] = x + 1;
  position[base + 7] = hb;
  position[base + 8] = z;
  position[base + 9] = x + 1;
  position[base + 10] = hb;
  position[base + 11] = z;
  position[base + 12] = x;
  position[base + 13] = hc;
  position[base + 14] = z + 1;
  position[base + 15] = x + 1;
  position[base + 16] = hd;
  position[base + 17] = z + 1;

  const [r, g, b] = BIOME_LINEAR[map.biomes[c]];
  const shade = cellShade(c);
  for (let v = 0; v < VERTS_PER_CELL; v++) {
    color[base + v * 3] = r * shade;
    color[base + v * 3 + 1] = g * shade;
    color[base + v * 3 + 2] = b * shade;
  }
}

/** Geometría no indexada: 6 vértices por celda y color plano por celda. */
export function createTerrainGeometry(map: MapData): BufferGeometry {
  const count = map.width * map.depth * FLOATS_PER_CELL;
  const position = new Float32Array(count);
  const color = new Float32Array(count);
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) writeCell(map, x, z, position, color);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('color', new BufferAttribute(color, 3));
  return geometry;
}

/** Reescribe solo las celdas del rectángulo y registra una subida parcial por fila. */
export function updateTerrainRange(geometry: BufferGeometry, map: MapData, rect: CellRect): void {
  const position = geometry.getAttribute('position') as BufferAttribute;
  const color = geometry.getAttribute('color') as BufferAttribute;
  const posArray = position.array as Float32Array;
  const colArray = color.array as Float32Array;
  const rowLength = (rect.maxX - rect.minX + 1) * FLOATS_PER_CELL;

  for (let z = rect.minZ; z <= rect.maxZ; z++) {
    for (let x = rect.minX; x <= rect.maxX; x++) writeCell(map, x, z, posArray, colArray);
    const start = cellIndex(map, rect.minX, z) * FLOATS_PER_CELL;
    position.addUpdateRange(start, rowLength);
    color.addUpdateRange(start, rowLength);
  }
  position.needsUpdate = true;
  color.needsUpdate = true;
}

/** Quads de agua. Se reconstruye entera cuando cambia alguna celda con agua. */
export function createWaterGeometry(map: MapData): BufferGeometry {
  const positions: number[] = [];
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const y = map.water[cellIndex(map, x, z)];
      if (Number.isNaN(y)) continue;
      positions.push(x, y, z, x, y, z + 1, x + 1, y, z, x + 1, y, z, x, y, z + 1, x + 1, y, z + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}
