import { describe, expect, it } from 'vitest';
import { createFlatMap, generateMap, sampleHeight } from './heightmap.ts';
import { mulberry32 } from './prng.ts';
import { HEIGHT_MAX, HEIGHT_MIN, vertexIndex } from './types.ts';

const params = { width: 64, depth: 64, createdAt: 'x' };

describe('mulberry32', () => {
  it('repite la secuencia con la misma seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('generateMap', () => {
  it('misma seed da heights idénticos', () => {
    const a = generateMap({ ...params, seed: 42 });
    const b = generateMap({ ...params, seed: 42 });
    expect(Buffer.from(a.heights.buffer).equals(Buffer.from(b.heights.buffer))).toBe(true);
    expect(a.biomes).toEqual(b.biomes);
  });

  it('otra seed los cambia', () => {
    const a = generateMap({ ...params, seed: 42 });
    const b = generateMap({ ...params, seed: 43 });
    expect(Buffer.from(a.heights.buffer).equals(Buffer.from(b.heights.buffer))).toBe(false);
  });

  it('dimensiona los arrays y respeta los límites de altura', () => {
    const map = generateMap({ ...params, width: 64, depth: 128, seed: 1, amplitude: 500 });
    expect(map.heights.length).toBe(65 * 129);
    expect(map.biomes.length).toBe(64 * 128);
    expect(map.water.length).toBe(64 * 128);
    expect(Math.max(...map.heights)).toBeLessThanOrEqual(HEIGHT_MAX);
    expect(Math.min(...map.heights)).toBeGreaterThanOrEqual(HEIGHT_MIN);
  });
});

describe('sampleHeight', () => {
  it('interpola por los triángulos de la celda y limita al borde', () => {
    const map = createFlatMap('t', 2, 2);
    map.heights[vertexIndex(map, 1, 1)] = 5;
    expect(sampleHeight(map, 1, 1)).toBe(5);
    expect(sampleHeight(map, 0.5, 0.5)).toBeCloseTo(1); // diagonal b-c
    expect(sampleHeight(map, 0.75, 0.75)).toBeCloseTo(3); // triángulo b-c-d
    expect(sampleHeight(map, -10, -10)).toBe(1);
    expect(sampleHeight(map, 99, 99)).toBe(1);
  });
});
