import { describe, expect, it } from 'vitest';
import { falloff, flatten, lower, paintBiome, raise, type BrushEdit } from './brushes.ts';
import { createFlatMap } from './heightmap.ts';
import { StrokeRecorder } from './history.ts';
import { BIOME, HEIGHT_MAX, HEIGHT_MIN, cellIndex, vertexIndex, type MapData } from './types.ts';

const params = { radius: 4, strength: 1, hardness: 0.25 };

function apply(map: MapData, edit: BrushEdit): void {
  new StrokeRecorder().apply(map, edit);
}

function distanceOf(map: MapData, index: number, cx: number, cz: number): number {
  const stride = map.width + 1;
  return Math.hypot((index % stride) - cx, Math.floor(index / stride) - cz);
}

describe('falloff', () => {
  it('vale 1 en el núcleo, decrece y es 0 en el radio', () => {
    expect(falloff(0, 4, 0.25)).toBe(1);
    expect(falloff(1, 4, 0.25)).toBe(1);
    expect(falloff(2, 4, 0.25)).toBeLessThan(1);
    expect(falloff(3, 4, 0.25)).toBeLessThan(falloff(2, 4, 0.25));
    expect(falloff(4, 4, 0.25)).toBe(0);
    expect(falloff(9, 4, 0.25)).toBe(0);
  });
});

describe('raise y lower', () => {
  it('son puros y solo proponen índices dentro del radio', () => {
    const map = createFlatMap('t', 32, 32);
    const before = map.heights.slice();
    const edit = raise(map, 16, 16, params);
    expect(map.heights).toEqual(before);
    expect(edit.heights.indices.length).toBeGreaterThan(0);
    for (const i of edit.heights.indices) {
      expect(distanceOf(map, i, 16, 16)).toBeLessThan(params.radius);
    }
  });

  it('aplican el falloff: centro con fuerza plena y borde con menos', () => {
    const map = createFlatMap('t', 32, 32);
    apply(map, raise(map, 16, 16, params));
    expect(map.heights[vertexIndex(map, 16, 16)]).toBeCloseTo(2);
    const edge = map.heights[vertexIndex(map, 19, 16)];
    expect(edge).toBeGreaterThan(1);
    expect(edge).toBeLessThan(2);
    expect(map.heights[vertexIndex(map, 20, 16)]).toBe(1);
  });

  it('lower aplica el mismo falloff hacia abajo', () => {
    const map = createFlatMap('t', 32, 32);
    apply(map, lower(map, 16, 16, params));
    expect(map.heights[vertexIndex(map, 16, 16)]).toBeCloseTo(0);
    const edge = map.heights[vertexIndex(map, 19, 16)];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
    expect(map.heights[vertexIndex(map, 20, 16)]).toBe(1);
  });

  it('no superan HEIGHT_MIN ni HEIGHT_MAX', () => {
    const map = createFlatMap('t', 16, 16);
    apply(map, raise(map, 8, 8, { ...params, strength: 1000 }));
    expect(map.heights[vertexIndex(map, 8, 8)]).toBe(HEIGHT_MAX);
    apply(map, lower(map, 8, 8, { ...params, strength: 1000 }));
    expect(map.heights[vertexIndex(map, 8, 8)]).toBe(HEIGHT_MIN);
  });

  it('el rectángulo sucio cubre las celdas vecinas y queda dentro del mapa', () => {
    const map = createFlatMap('t', 16, 16);
    const { rect } = raise(map, 0, 0, params);
    expect(rect).toEqual({ minX: 0, minZ: 0, maxX: 3, maxZ: 3 });
  });
});

describe('flatten', () => {
  it('lleva al objetivo dentro del núcleo y no toca fuera del radio', () => {
    const map = createFlatMap('t', 32, 32);
    apply(map, raise(map, 10, 16, { radius: 8, strength: 5, hardness: 1 }));
    const outside = map.heights[vertexIndex(map, 24, 16)];
    apply(map, flatten(map, 12, 16, { radius: 4, strength: 1, hardness: 1 }, 3));
    expect(map.heights[vertexIndex(map, 12, 16)]).toBe(3);
    expect(map.heights[vertexIndex(map, 24, 16)]).toBe(outside);
  });
});

describe('flatten con falloff', () => {
  it('el borde queda entre el valor original y el objetivo', () => {
    const map = createFlatMap('t', 32, 32);
    apply(map, flatten(map, 16, 16, params, 5));
    expect(map.heights[vertexIndex(map, 16, 16)]).toBe(5);
    const edge = map.heights[vertexIndex(map, 19, 16)];
    expect(edge).toBeGreaterThan(1);
    expect(edge).toBeLessThan(5);
    expect(map.heights[vertexIndex(map, 20, 16)]).toBe(1);
  });

  it('strength 0.5 recorre la mitad del camino en el núcleo', () => {
    const map = createFlatMap('t', 32, 32);
    apply(map, flatten(map, 16, 16, { ...params, strength: 0.5 }, 5));
    expect(map.heights[vertexIndex(map, 16, 16)]).toBeCloseTo(3);
  });
});

describe('paintBiome', () => {
  it('agua fija max(4 esquinas) + 0.1 y otro bioma la limpia', () => {
    const map = createFlatMap('t', 8, 8);
    map.heights[vertexIndex(map, 4, 4)] = 2;
    const c = cellIndex(map, 3, 3);
    apply(map, paintBiome(map, 3.5, 3.5, 1, BIOME.agua));
    expect(map.biomes[c]).toBe(BIOME.agua);
    expect(map.water[c]).toBeCloseTo(2.1);
    apply(map, paintBiome(map, 3.5, 3.5, 1, BIOME.roca));
    expect(map.biomes[c]).toBe(BIOME.roca);
    expect(map.water[c]).toBeNaN();
  });

  it('no toca celdas fuera del radio', () => {
    const map = createFlatMap('t', 8, 8);
    const edit = paintBiome(map, 3.5, 3.5, 1, BIOME.nieve);
    expect(edit.biomes.indices).toEqual([cellIndex(map, 3, 3)]);
    expect(edit.rect).toEqual({ minX: 3, minZ: 3, maxX: 3, maxZ: 3 });
  });
});
