import { describe, expect, it } from 'vitest';
import {
  MAX_DISTINCT_ASSETS,
  MAX_PROPS,
  MAX_PROP_SCALE,
  MAX_TEXT_LENGTH,
  parseMap,
  serializeMap,
} from './exporter.ts';
import { generateMap } from './heightmap.ts';
import type { MapData } from './types.ts';

function sampleMap(): MapData {
  const map = generateMap({ name: 'Prueba', width: 64, depth: 64, seed: 9, createdAt: '2026-01-01' });
  map.water.fill(Number.NaN);
  map.water[70] = 1.25;
  map.props = [
    { asset: 'arbol', position: [1.5, 2.25, 3.5], rotationY: 0.5, scale: 1.2 },
    { asset: 'no-cargado.glb', position: [4, 5, 6], rotationY: 0, scale: 1 },
  ];
  return map;
}

function mutated(change: (data: any) => void): string {
  const data = JSON.parse(serializeMap(sampleMap()));
  change(data);
  return JSON.stringify(data);
}

describe('serializeMap', () => {
  it('produce la forma por capas con agua dispersa y 3 decimales', () => {
    const data = JSON.parse(serializeMap(sampleMap()));
    expect(data.version).toBe(1);
    expect(data.metadata).toEqual({
      name: 'Prueba',
      width: 64,
      depth: 64,
      cellSize: 1,
      createdAt: '2026-01-01',
    });
    expect(data.terrain.heights).toHaveLength(65 * 65);
    expect(data.terrain.biomes).toHaveLength(64 * 64);
    expect(data.terrain.biomePalette).toHaveLength(6);
    expect(data.water).toEqual([[6, 1, 1.25]]);
    for (const h of data.terrain.heights) {
      expect(Math.abs(h * 1000 - Math.round(h * 1000))).toBeLessThan(1e-6);
    }
  });
});

describe('parseMap', () => {
  it('parseMap(serializeMap(m)) equivale a m', () => {
    const map = sampleMap();
    const result = parseMap(serializeMap(map));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { heights, ...rest } = result.map;
    const { heights: original, ...expected } = map;
    expect(rest).toEqual(expected);
    original.forEach((h, i) => expect(Math.abs(heights[i] - h)).toBeLessThanOrEqual(0.00051));
  });

  it('una segunda vuelta es idéntica', () => {
    const first = serializeMap(sampleMap());
    const result = parseMap(first);
    expect(result.ok && serializeMap(result.map)).toBe(first);
  });

  it('conserva props de assets no cargados', () => {
    const result = parseMap(serializeMap(sampleMap()));
    expect(result.ok && result.map.props[1].asset).toBe('no-cargado.glb');
  });

  it.each<[string, string]>([
    ['JSON roto', '{nope'],
    ['no objeto', '[]'],
    ['versión', mutated((d) => (d.version = 2))],
    ['sin metadata', mutated((d) => delete d.metadata)],
    ['sin terrain', mutated((d) => delete d.terrain)],
    ['sin water', mutated((d) => delete d.water)],
    ['sin props', mutated((d) => delete d.props)],
    ['water no lista', mutated((d) => (d.water = {}))],
    ['props no lista', mutated((d) => (d.props = {}))],
    ['name no texto', mutated((d) => (d.metadata.name = 5))],
    ['name largo', mutated((d) => (d.metadata.name = 'x'.repeat(MAX_TEXT_LENGTH + 1)))],
    ['createdAt ausente', mutated((d) => delete d.metadata.createdAt)],
    ['createdAt largo', mutated((d) => (d.metadata.createdAt = 'x'.repeat(MAX_TEXT_LENGTH + 1)))],
    ['cellSize cero', mutated((d) => (d.metadata.cellSize = 0))],
    ['cellSize texto', mutated((d) => (d.metadata.cellSize = '1'))],
    ['rotationY texto', mutated((d) => (d.props[0].rotationY = 'a'))],
    ['rotationY enorme', mutated((d) => (d.props[0].rotationY = 1e39))],
    ['asset largo', mutated((d) => (d.props[0].asset = 'x'.repeat(MAX_TEXT_LENGTH + 1)))],
    ['water corto', mutated((d) => d.water.push([1, 1]))],
    ['nivel enorme', mutated((d) => (d.water[0][2] = 1e39))],
    ['water excesivo', mutated((d) => (d.water = Array(64 * 64 + 1).fill([0, 0, 1])))],
    ['prop y enorme', mutated((d) => (d.props[0].position[1] = 1e39))],
    ['prop x fuera', mutated((d) => (d.props[0].position[0] = 500))],
    ['prop z fuera', mutated((d) => (d.props[0].position[2] = -500))],
    ['escala mínima', mutated((d) => (d.props[0].scale = 0.0001))],
    ['escala enorme', mutated((d) => (d.props[0].scale = MAX_PROP_SCALE + 1))],
    ['demasiados props', mutated((d) => (d.props = Array(MAX_PROPS + 1).fill(d.props[0])))],
    [
      'demasiados assets',
      mutated((d) => {
        d.props = Array.from({ length: MAX_DISTINCT_ASSETS + 1 }, (_, i) => ({
          ...d.props[0],
          asset: `a${i}.glb`,
        }));
      }),
    ],
    ['ancho inválido', mutated((d) => (d.metadata.width = 'x'))],
    ['ancho enorme', mutated((d) => (d.metadata.width = 1e9))],
    ['heights corto', mutated((d) => d.terrain.heights.pop())],
    ['height no numérico', mutated((d) => (d.terrain.heights[3] = 'a'))],
    ['height fuera de rango', mutated((d) => (d.terrain.heights[3] = 1e6))],
    ['biomes corto', mutated((d) => d.terrain.biomes.pop())],
    ['bioma inválido', mutated((d) => (d.terrain.biomes[0] = 99))],
    ['paleta', mutated((d) => (d.terrain.biomePalette = ['x']))],
    ['agua fuera', mutated((d) => d.water.push([999, 0, 1]))],
    ['prop mal formado', mutated((d) => (d.props[0].position = [1]))],
    ['escala negativa', mutated((d) => (d.props[0].scale = -1))],
  ])('rechaza con error legible: %s', (_, text) => {
    const result = parseMap(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(5);
  });
});
