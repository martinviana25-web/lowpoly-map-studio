import { BIOME, type BiomeId } from './types.ts';

export interface BiomeDef {
  id: BiomeId;
  key: string;
  label: string;
  /** Color sRGB, 0xRRGGBB. */
  color: number;
}

export const BIOMES: readonly BiomeDef[] = [
  { id: BIOME.pasto, key: 'pasto', label: 'Pasto', color: 0x6fae4f },
  { id: BIOME.arena, key: 'arena', label: 'Arena', color: 0xdcc98a },
  { id: BIOME.roca, key: 'roca', label: 'Roca', color: 0x8a8580 },
  { id: BIOME.pantano, key: 'pantano', label: 'Pantano', color: 0x5a6b3c },
  { id: BIOME.nieve, key: 'nieve', label: 'Nieve', color: 0xf0f3f7 },
  { id: BIOME.agua, key: 'agua', label: 'Agua', color: 0x2f6f9f },
];

/** Paleta del JSON: el índice es el id de bioma. */
export const BIOME_PALETTE: readonly string[] = BIOMES.map((b) => b.key);

export const SEA_LEVEL = 0;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Color lineal [r, g, b] por bioma, listo para el atributo de vértices. */
export const BIOME_LINEAR: readonly (readonly [number, number, number])[] = BIOMES.map((b) => [
  srgbToLinear(((b.color >> 16) & 255) / 255),
  srgbToLinear(((b.color >> 8) & 255) / 255),
  srgbToLinear((b.color & 255) / 255),
]);

/** Bioma inicial según la altura media de la celda. */
export function biomeFromHeight(height: number): BiomeId {
  if (height < SEA_LEVEL + 0.8) return BIOME.arena;
  if (height < 2.2) return BIOME.pantano;
  if (height < 9) return BIOME.pasto;
  if (height < 14) return BIOME.roca;
  return BIOME.nieve;
}
