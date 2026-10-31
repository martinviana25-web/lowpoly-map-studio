import { clampHeight, maxCorner } from './heightmap.ts';
import { BIOME, cellIndex, vertexIndex, type BiomeId, type CellRect, type MapData } from './types.ts';

export interface BrushParams {
  /** Radio en celdas. */
  radius: number;
  /** Altura máxima por aplicación (raise/lower) o fracción 0..1 (flatten). */
  strength: number;
  /** 0 = borde muy suave, 1 = borde duro. */
  hardness: number;
}

export interface ChannelEdit {
  indices: number[];
  values: number[];
}

/**
 * Resultado de un pincel: qué cambiaría y dónde. Los pinceles son puros, no
 * mutan el mapa; lo aplica `StrokeRecorder` para capturar el "antes".
 */
export interface BrushEdit {
  heights: ChannelEdit;
  biomes: ChannelEdit;
  water: ChannelEdit;
  rect: CellRect | null;
}

function emptyEdit(): BrushEdit {
  return {
    heights: { indices: [], values: [] },
    biomes: { indices: [], values: [] },
    water: { indices: [], values: [] },
    rect: null,
  };
}

/** Peso 1 dentro del núcleo duro y smoothstep hasta 0 en el radio. */
export function falloff(distance: number, radius: number, hardness: number): number {
  if (distance >= radius) return 0;
  const inner = Math.min(0.999, Math.max(0, hardness));
  const t = distance / radius;
  if (t <= inner) return 1;
  const s = (t - inner) / (1 - inner);
  return 1 - s * s * (3 - 2 * s);
}

function includeRect(edit: BrushEdit, rect: CellRect): void {
  const r = edit.rect;
  if (!r) {
    edit.rect = { ...rect };
    return;
  }
  r.minX = Math.min(r.minX, rect.minX);
  r.minZ = Math.min(r.minZ, rect.minZ);
  r.maxX = Math.max(r.maxX, rect.maxX);
  r.maxZ = Math.max(r.maxZ, rect.maxZ);
}

function editHeights(
  map: MapData,
  cx: number,
  cz: number,
  params: BrushParams,
  next: (height: number, weight: number) => number,
): BrushEdit {
  const edit = emptyEdit();
  const { radius, hardness } = params;
  const x0 = Math.max(0, Math.ceil(cx - radius));
  const x1 = Math.min(map.width, Math.floor(cx + radius));
  const z0 = Math.max(0, Math.ceil(cz - radius));
  const z1 = Math.min(map.depth, Math.floor(cz + radius));

  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const weight = falloff(Math.hypot(x - cx, z - cz), radius, hardness);
      if (weight <= 0) continue;
      const i = vertexIndex(map, x, z);
      const before = map.heights[i];
      const after = Math.fround(clampHeight(next(before, weight)));
      if (after === before) continue;
      edit.heights.indices.push(i);
      edit.heights.values.push(after);
      // Un vértice afecta a las hasta cuatro celdas que lo comparten.
      includeRect(edit, {
        minX: Math.max(0, x - 1),
        minZ: Math.max(0, z - 1),
        maxX: Math.min(map.width - 1, x),
        maxZ: Math.min(map.depth - 1, z),
      });
    }
  }
  return edit;
}

export function raise(map: MapData, cx: number, cz: number, params: BrushParams): BrushEdit {
  return editHeights(map, cx, cz, params, (h, w) => h + params.strength * w);
}

export function lower(map: MapData, cx: number, cz: number, params: BrushParams): BrushEdit {
  return editHeights(map, cx, cz, params, (h, w) => h - params.strength * w);
}

/** Acerca las alturas a `target`, muestreada una sola vez al iniciar el stroke. */
export function flatten(
  map: MapData,
  cx: number,
  cz: number,
  params: BrushParams,
  target: number,
): BrushEdit {
  const rate = Math.min(1, params.strength);
  return editHeights(map, cx, cz, params, (h, w) => h + (target - h) * rate * w);
}

/** Pinta las celdas cuyo centro cae en el radio. Agua fija el nivel; otro bioma lo limpia. */
export function paintBiome(
  map: MapData,
  cx: number,
  cz: number,
  radius: number,
  biome: BiomeId,
): BrushEdit {
  const edit = emptyEdit();
  const x0 = Math.max(0, Math.ceil(cx - radius - 0.5));
  const x1 = Math.min(map.width - 1, Math.floor(cx + radius - 0.5));
  const z0 = Math.max(0, Math.ceil(cz - radius - 0.5));
  const z1 = Math.min(map.depth - 1, Math.floor(cz + radius - 0.5));

  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) >= radius) continue;
      const c = cellIndex(map, x, z);
      const level = biome === BIOME.agua ? Math.fround(maxCorner(map, x, z) + 0.1) : Number.NaN;
      const biomeChanged = map.biomes[c] !== biome;
      const waterChanged = !Object.is(map.water[c], level);
      if (!biomeChanged && !waterChanged) continue;
      if (biomeChanged) {
        edit.biomes.indices.push(c);
        edit.biomes.values.push(biome);
      }
      if (waterChanged) {
        edit.water.indices.push(c);
        edit.water.values.push(level);
      }
      includeRect(edit, { minX: x, minZ: z, maxX: x, maxZ: z });
    }
  }
  return edit;
}
