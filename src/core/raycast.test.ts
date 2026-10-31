import { describe, expect, it } from 'vitest';
import { createFlatMap, sampleHeight } from './heightmap.ts';
import { raycastHeightfield } from './raycast.ts';
import { vertexIndex } from './types.ts';

describe('raycastHeightfield', () => {
  it('acierta en vertical sobre terreno plano', () => {
    const map = createFlatMap('t', 16, 16);
    const hit = raycastHeightfield(map, [8, 50, 8], [0, -1, 0])!;
    expect(hit[0]).toBeCloseTo(8);
    expect(hit[1]).toBeCloseTo(1, 2);
    expect(hit[2]).toBeCloseTo(8);
  });

  it('acierta en diagonal, con dirección sin normalizar', () => {
    const map = createFlatMap('t', 16, 16);
    const hit = raycastHeightfield(map, [2, 21, 2], [10, -40, 5])!;
    expect(hit[0]).toBeCloseTo(7, 2);
    expect(hit[1]).toBeCloseTo(1, 2);
    expect(hit[2]).toBeCloseTo(4.5, 2);
  });

  it('choca primero con una elevación en el camino', () => {
    const map = createFlatMap('t', 16, 16);
    for (let z = 0; z <= 16; z++) {
      map.heights[vertexIndex(map, 8, z)] = 10;
    }
    const hit = raycastHeightfield(map, [0.5, 9, 8], [1, 0, 0])!;
    expect(hit[0]).toBeGreaterThan(7);
    expect(hit[0]).toBeLessThan(8);
    expect(hit[1]).toBeCloseTo(sampleHeight(map, hit[0], hit[2]), 2);
  });

  it('devuelve null fuera del mapa', () => {
    const map = createFlatMap('t', 16, 16);
    expect(raycastHeightfield(map, [-5, 50, 8], [0, -1, 0])).toBeNull();
    expect(raycastHeightfield(map, [100, 50, 100], [1, -1, 0])).toBeNull();
    expect(raycastHeightfield(map, [8, 50, 8], [0, 1, 0])).toBeNull();
    expect(raycastHeightfield(map, [-5, 3, 8], [1, -2, 0])).toBeNull();
  });

  it('acierta un rayo que entra desde afuera del mapa', () => {
    const map = createFlatMap('t', 16, 16);
    const hit = raycastHeightfield(map, [-2, 6, 8], [1, -1, 0])!;
    expect(hit[0]).toBeCloseTo(3, 2);
    expect(hit[1]).toBeCloseTo(1, 2);
    expect(hit[2]).toBeCloseTo(8);
  });

  it('devuelve null si el rayo sale por el costado sin tocar el suelo', () => {
    const map = createFlatMap('t', 16, 16);
    expect(raycastHeightfield(map, [8, 5, 8], [1, 0, 0])).toBeNull();
  });
});
