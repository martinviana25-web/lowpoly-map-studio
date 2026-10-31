// Tipos y constantes del modelo de mapa. Celda de 1 unidad, Y arriba.
// El terreno ocupa x en [0, width] y z en [0, depth].

export const MAP_SIZES = [64, 128, 256] as const;
export const DEFAULT_MAP_SIZE = 128;
export const MAX_MAP_SIZE = 256;
export const CELL_SIZE = 1;
export const HEIGHT_MIN = -8;
export const HEIGHT_MAX = 32;

export const BIOME = {
  pasto: 0,
  arena: 1,
  roca: 2,
  pantano: 3,
  nieve: 4,
  agua: 5,
} as const;

export type BiomeId = (typeof BIOME)[keyof typeof BIOME];

export interface PropInstance {
  asset: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

export interface MapData {
  name: string;
  width: number;
  depth: number;
  cellSize: number;
  createdAt: string;
  /** Altura por vértice, row-major, tamaño (width+1)*(depth+1). */
  heights: Float32Array;
  /** Bioma por celda, row-major, tamaño width*depth. */
  biomes: Uint8Array;
  /** Nivel de agua por celda; NaN = sin agua. */
  water: Float32Array;
  props: PropInstance[];
}

/** Rectángulo de celdas, con ambos extremos inclusive. */
export interface CellRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export function vertexIndex(map: Pick<MapData, 'width'>, x: number, z: number): number {
  return z * (map.width + 1) + x;
}

export function cellIndex(map: Pick<MapData, 'width'>, x: number, z: number): number {
  return z * map.width + x;
}

export function mergeRects(a: CellRect | null, b: CellRect | null): CellRect | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX),
    maxZ: Math.max(a.maxZ, b.maxZ),
  };
}
