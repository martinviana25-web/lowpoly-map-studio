import { createNoise2D } from 'simplex-noise';
import { SEA_LEVEL, biomeFromHeight } from './biomes.ts';
import { mulberry32 } from './prng.ts';
import {
  BIOME,
  CELL_SIZE,
  DEFAULT_MAP_SIZE,
  HEIGHT_MAX,
  HEIGHT_MIN,
  cellIndex,
  vertexIndex,
  type MapData,
} from './types.ts';

export interface GenerateParams {
  name?: string;
  width?: number;
  depth?: number;
  seed: number;
  octaves?: number;
  /** Tamaño en celdas de la ondulación más grande. */
  scale?: number;
  amplitude?: number;
  createdAt?: string;
}

export function clampHeight(h: number): number {
  return Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, h));
}

/** Mapa plano en altura 1, sin agua ni props. */
export function createFlatMap(name: string, width: number, depth: number): MapData {
  return {
    name,
    width,
    depth,
    cellSize: CELL_SIZE,
    createdAt: new Date().toISOString(),
    heights: new Float32Array((width + 1) * (depth + 1)).fill(1),
    biomes: new Uint8Array(width * depth).fill(BIOME.pasto),
    water: new Float32Array(width * depth).fill(Number.NaN),
    props: [],
  };
}

/** Genera el terreno con fBm de simplex. Misma seed y parámetros = mismo mapa. */
export function generateMap(params: GenerateParams): MapData {
  const {
    name = 'Mapa sin título',
    width = DEFAULT_MAP_SIZE,
    depth = DEFAULT_MAP_SIZE,
    seed,
    octaves = 4,
    scale = 48,
    amplitude = 10,
    createdAt = new Date().toISOString(),
  } = params;

  const map = createFlatMap(name, width, depth);
  map.createdAt = createdAt;
  const noise = createNoise2D(mulberry32(seed));

  for (let z = 0; z <= depth; z++) {
    for (let x = 0; x <= width; x++) {
      let value = 0;
      let amp = 1;
      let freq = 1 / scale;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        value += amp * noise(x * freq, z * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      map.heights[vertexIndex(map, x, z)] = clampHeight(3.5 + (value / norm) * amplitude * 1.4);
    }
  }

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const c = cellIndex(map, x, z);
      if (maxCorner(map, x, z) < SEA_LEVEL) {
        map.biomes[c] = BIOME.agua;
        map.water[c] = SEA_LEVEL;
      } else {
        map.biomes[c] = biomeFromHeight(averageCorner(map, x, z));
      }
    }
  }
  return map;
}

function corners(map: MapData, x: number, z: number): [number, number, number, number] {
  const a = vertexIndex(map, x, z);
  const c = vertexIndex(map, x, z + 1);
  return [map.heights[a], map.heights[a + 1], map.heights[c], map.heights[c + 1]];
}

export function maxCorner(map: MapData, x: number, z: number): number {
  return Math.max(...corners(map, x, z));
}

function averageCorner(map: MapData, x: number, z: number): number {
  const [a, b, c, d] = corners(map, x, z);
  return (a + b + c + d) / 4;
}

/**
 * Altura exacta de la superficie en (x, z), siguiendo los dos triángulos de la
 * celda (diagonal b-c). Fuera del mapa se limita al borde.
 */
export function sampleHeight(map: MapData, x: number, z: number): number {
  const px = Math.min(map.width, Math.max(0, x));
  const pz = Math.min(map.depth, Math.max(0, z));
  const cx = Math.min(map.width - 1, Math.floor(px));
  const cz = Math.min(map.depth - 1, Math.floor(pz));
  const u = px - cx;
  const v = pz - cz;
  const [a, b, c, d] = corners(map, cx, cz);
  if (u + v <= 1) return a + u * (b - a) + v * (c - a);
  return d + (1 - u) * (c - d) + (1 - v) * (b - d);
}
