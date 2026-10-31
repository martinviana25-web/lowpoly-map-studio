import type { BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { paintBiome, raise } from './brushes.ts';
import { generateMap } from './heightmap.ts';
import { StrokeRecorder } from './history.ts';
import { createTerrainGeometry, createWaterGeometry, updateTerrainRange } from './terrainMesh.ts';
import { BIOME } from './types.ts';

const FLOATS_PER_CELL = 18;

function attributes(geometry: ReturnType<typeof createTerrainGeometry>) {
  return {
    position: geometry.getAttribute('position') as BufferAttribute,
    color: geometry.getAttribute('color') as BufferAttribute,
  };
}

function editedMap() {
  const map = generateMap({ width: 64, depth: 64, seed: 3, createdAt: 'x' });
  const geometry = createTerrainGeometry(map);
  const recorder = new StrokeRecorder();
  const raised = raise(map, 20, 30, { radius: 5, strength: 2, hardness: 0.5 });
  const painted = paintBiome(map, 20, 30, 4, BIOME.nieve);
  recorder.apply(map, raised);
  recorder.apply(map, painted);
  return { map, geometry, rect: recorder.finish(map)!.rect };
}

describe('createTerrainGeometry', () => {
  it('genera 6 vértices por celda con caras hacia arriba', () => {
    const map = generateMap({ width: 64, depth: 64, seed: 3, createdAt: 'x' });
    const { position } = attributes(createTerrainGeometry(map));
    expect(position.count).toBe(64 * 64 * 6);
    const [ax, , az, bx, , bz, cx, , cz] = position.array;
    const crossY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    expect(crossY).toBeGreaterThan(0);
  });
});

describe('updateTerrainRange', () => {
  it('iguala una reconstrucción completa', () => {
    const { map, geometry, rect } = editedMap();
    updateTerrainRange(geometry, map, rect);
    const full = attributes(createTerrainGeometry(map));
    const partial = attributes(geometry);
    expect(partial.position.array).toEqual(full.position.array);
    expect(partial.color.array).toEqual(full.color.array);
  });

  it('solo toca el rango sucio', () => {
    const { map, geometry, rect } = editedMap();
    const { position, color } = attributes(geometry);
    const SENTINEL = -999;
    (position.array as Float32Array).fill(SENTINEL);

    updateTerrainRange(geometry, map, rect);

    const cols = rect.maxX - rect.minX + 1;
    const rows = rect.maxZ - rect.minZ + 1;
    const written = (position.array as Float32Array).filter((v) => v !== SENTINEL).length;
    expect(written).toBe(cols * rows * FLOATS_PER_CELL);

    const expected = Array.from({ length: rows }, (_, row) => ({
      start: ((rect.minZ + row) * map.width + rect.minX) * FLOATS_PER_CELL,
      count: cols * FLOATS_PER_CELL,
    }));
    expect(position.updateRanges).toEqual(expected);
    expect(color.updateRanges).toEqual(expected);
  });
});

describe('createWaterGeometry', () => {
  it('emite un quad por celda con agua', () => {
    const map = generateMap({ width: 64, depth: 64, seed: 3, createdAt: 'x' });
    map.water.fill(Number.NaN);
    map.water[5] = 1;
    map.water[9] = 2;
    expect(createWaterGeometry(map).getAttribute('position').count).toBe(12);
  });
});
