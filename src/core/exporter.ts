import { BIOME_PALETTE } from './biomes.ts';
import {
  HEIGHT_MAX,
  HEIGHT_MIN,
  MAX_MAP_SIZE,
  cellIndex,
  type MapData,
  type PropInstance,
} from './types.ts';

export const SCHEMA_VERSION = 1;
export const MAX_TEXT_LENGTH = 256;
export const MAX_PROPS = 200_000;
export const MAX_DISTINCT_ASSETS = 256;
export const MAX_PROP_SCALE = 1000;
const MIN_PROP_SCALE = 0.001;
const MAX_ROTATION = 1000;
/** Holgura sobre el rango de alturas y los bordes del mapa. */
const MARGIN = 1;

export type ParseResult = { ok: true; map: MapData } | { ok: false; error: string };

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Serializa el mapa al JSON por capas de `docs/map-format.md`. */
export function serializeMap(map: MapData): string {
  const water: [number, number, number][] = [];
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const level = map.water[cellIndex(map, x, z)];
      if (!Number.isNaN(level)) water.push([x, z, round3(level)]);
    }
  }
  return JSON.stringify({
    version: SCHEMA_VERSION,
    metadata: {
      name: map.name,
      width: map.width,
      depth: map.depth,
      cellSize: map.cellSize,
      createdAt: map.createdAt,
    },
    terrain: {
      heights: Array.from(map.heights, round3),
      biomes: Array.from(map.biomes),
      biomePalette: BIOME_PALETTE,
    },
    water,
    props: map.props.map((p) => ({
      asset: p.asset,
      position: p.position.map(round3),
      rotationY: round3(p.rotationY),
      scale: round3(p.scale),
    })),
  });
}

class FormatError extends Error {}

function fail(message: string): never {
  throw new FormatError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseSize(label: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_MAP_SIZE) {
    fail(`metadata.${label} debe ser un entero entre 1 y ${MAX_MAP_SIZE}.`);
  }
  return value;
}

function parseText(label: string, value: unknown): string {
  if (typeof value !== 'string') fail(`${label} debe ser un texto.`);
  if (value.length > MAX_TEXT_LENGTH) fail(`${label} supera los ${MAX_TEXT_LENGTH} caracteres.`);
  return value;
}

function inHeightRange(y: number): boolean {
  return y >= HEIGHT_MIN - MARGIN && y <= HEIGHT_MAX + MARGIN;
}

function parseProp(value: unknown, index: number, width: number, depth: number): PropInstance {
  const where = `props[${index}]`;
  if (!isObject(value)) fail(`${where} no es un objeto.`);
  const { position, rotationY, scale } = value;
  const asset = parseText(`${where}.asset`, value.asset);
  if (asset === '') fail(`${where}.asset debe ser un texto no vacío.`);
  if (!Array.isArray(position) || position.length !== 3 || !position.every(isFiniteNumber)) {
    fail(`${where}.position debe ser [x, y, z] numérico.`);
  }
  const [x, y, z] = position;
  if (x < -MARGIN || x > width + MARGIN || z < -MARGIN || z > depth + MARGIN) {
    fail(`${where}.position está fuera del mapa.`);
  }
  if (!inHeightRange(y)) fail(`${where}.position tiene una altura fuera de rango.`);
  if (!isFiniteNumber(rotationY) || Math.abs(rotationY) > MAX_ROTATION) {
    fail(`${where}.rotationY debe ser un número entre -${MAX_ROTATION} y ${MAX_ROTATION}.`);
  }
  if (!isFiniteNumber(scale) || scale < MIN_PROP_SCALE || scale > MAX_PROP_SCALE) {
    fail(`${where}.scale debe estar entre ${MIN_PROP_SCALE} y ${MAX_PROP_SCALE}.`);
  }
  return { asset, position: [x, y, z], rotationY, scale };
}

function parseProps(props: unknown[], width: number, depth: number): PropInstance[] {
  if (props.length > MAX_PROPS) fail(`"props" supera el máximo de ${MAX_PROPS}.`);
  const parsed = props.map((prop, i) => parseProp(prop, i, width, depth));
  if (new Set(parsed.map((p) => p.asset)).size > MAX_DISTINCT_ASSETS) {
    fail(`"props" usa más de ${MAX_DISTINCT_ASSETS} assets distintos.`);
  }
  return parsed;
}

function parseWater(water: unknown[], width: number, depth: number): Float32Array {
  if (water.length > width * depth) fail('"water" tiene más entradas que celdas el mapa.');
  const levels = new Float32Array(width * depth).fill(Number.NaN);
  water.forEach((entry, i) => {
    if (!Array.isArray(entry) || entry.length !== 3 || !entry.every(isFiniteNumber)) {
      fail(`water[${i}] debe ser [x, z, nivel].`);
    }
    const [x, z, level] = entry;
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= width || z >= depth) {
      fail(`water[${i}] apunta fuera del mapa.`);
    }
    if (!inHeightRange(level)) fail(`water[${i}] tiene un nivel fuera de rango.`);
    levels[z * width + x] = level;
  });
  return levels;
}

function build(data: unknown): MapData {
  if (!isObject(data)) fail('El archivo no contiene un objeto JSON.');
  if (data.version !== SCHEMA_VERSION) {
    fail(`Versión no soportada: ${String(data.version)} (se espera ${SCHEMA_VERSION}).`);
  }
  const { metadata, terrain, water, props } = data;
  if (!isObject(metadata)) fail('Falta "metadata".');
  if (!isObject(terrain)) fail('Falta "terrain".');
  if (!Array.isArray(water)) fail('"water" debe ser una lista.');
  if (!Array.isArray(props)) fail('"props" debe ser una lista.');

  const { cellSize } = metadata;
  const name = parseText('metadata.name', metadata.name);
  const createdAt = parseText('metadata.createdAt', metadata.createdAt);
  if (!isFiniteNumber(cellSize) || cellSize <= 0) fail('metadata.cellSize debe ser positivo.');
  const width = parseSize('width', metadata.width);
  const depth = parseSize('depth', metadata.depth);

  const { heights, biomes, biomePalette } = terrain;
  if (!Array.isArray(heights) || heights.length !== (width + 1) * (depth + 1)) {
    fail(`terrain.heights debe tener ${(width + 1) * (depth + 1)} valores.`);
  }
  if (!Array.isArray(biomes) || biomes.length !== width * depth) {
    fail(`terrain.biomes debe tener ${width * depth} valores.`);
  }
  if (
    !Array.isArray(biomePalette) ||
    biomePalette.length !== BIOME_PALETTE.length ||
    biomePalette.some((key, i) => key !== BIOME_PALETTE[i])
  ) {
    fail('terrain.biomePalette no coincide con la paleta conocida.');
  }
  if (!heights.every((h) => isFiniteNumber(h) && h >= HEIGHT_MIN && h <= HEIGHT_MAX)) {
    fail(`terrain.heights contiene valores fuera de ${HEIGHT_MIN}..${HEIGHT_MAX}.`);
  }
  if (!biomes.every((b) => Number.isInteger(b) && b >= 0 && b < BIOME_PALETTE.length)) {
    fail('terrain.biomes contiene índices de bioma inválidos.');
  }

  return {
    name,
    width,
    depth,
    cellSize,
    createdAt,
    heights: Float32Array.from(heights),
    biomes: Uint8Array.from(biomes),
    water: parseWater(water, width, depth),
    props: parseProps(props, width, depth),
  };
}

/** Valida y construye un mapa. Ante cualquier problema devuelve un error legible. */
export function parseMap(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' };
  }
  try {
    return { ok: true, map: build(data) };
  } catch (error) {
    if (error instanceof FormatError) return { ok: false, error: error.message };
    throw error;
  }
}
