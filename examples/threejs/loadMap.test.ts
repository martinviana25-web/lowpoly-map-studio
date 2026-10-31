import { readFileSync } from 'node:fs';
import {
  Color,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type MeshStandardMaterial,
} from 'three';
import { describe, expect, it } from 'vitest';
import { BIOMES } from '../../src/core/biomes.ts';
import { loadMap } from './loadMap.js';

const data = JSON.parse(readFileSync(new URL('../sample-map.json', import.meta.url), 'utf8'));

describe('loadMap', () => {
  const { group, terrain, water, instances } = loadMap(data);

  it('reconstruye el terreno con 6 vértices por celda', () => {
    expect(terrain.geometry.getAttribute('position').count).toBe(64 * 64 * 6);
    expect(terrain.geometry.getAttribute('color').count).toBe(64 * 64 * 6);
    expect(group.children).toContain(terrain);
  });

  it('copia alturas y color del JSON en vértices conocidos', () => {
    const { width, depth } = data.metadata;
    const { heights, biomes, biomePalette } = data.terrain;
    const stride = width + 1;
    const position = terrain.geometry.getAttribute('position');
    const color = terrain.geometry.getAttribute('color');

    for (const [x, z] of [[0, 0], [17, 9], [width - 1, depth - 1]]) {
      const v = (z * width + x) * 6;
      const corners = [
        [x, heights[z * stride + x], z],
        [x, heights[(z + 1) * stride + x], z + 1],
        [x + 1, heights[z * stride + x + 1], z],
        [x + 1, heights[z * stride + x + 1], z],
        [x, heights[(z + 1) * stride + x], z + 1],
        [x + 1, heights[(z + 1) * stride + x + 1], z + 1],
      ];
      const biome = BIOMES.find((b) => b.key === biomePalette[biomes[z * width + x]])!;
      const tint = new Color(biome.color);
      corners.forEach(([px, py, pz], i) => {
        expect(position.getX(v + i)).toBe(px);
        expect(position.getY(v + i)).toBeCloseTo(py, 5);
        expect(position.getZ(v + i)).toBe(pz);
        expect(color.getX(v + i)).toBeCloseTo(tint.r, 5);
        expect(color.getY(v + i)).toBeCloseTo(tint.g, 5);
        expect(color.getZ(v + i)).toBeCloseTo(tint.b, 5);
      });
    }
  });

  it('todas las caras del terreno miran hacia arriba', () => {
    const position = terrain.geometry.getAttribute('position');
    const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);
    }
  });

  it('el agua usa flatShading porque no tiene normales', () => {
    expect((water!.material as MeshStandardMaterial).flatShading).toBe(true);
  });

  it('agrega terreno, agua e instancias al grupo', () => {
    expect(group.children).toContain(terrain);
    expect(group.children).toContain(water);
    for (const mesh of instances.values()) expect(group.children).toContain(mesh);
  });

  it('cada instancia conserva posición, rotación y escala del JSON', () => {
    const seen = new Map<string, number>();
    const matrix = new Matrix4();
    const [position, scale] = [new Vector3(), new Vector3()];
    const rotation = new Quaternion();
    const expectedRotation = new Quaternion();
    const up = new Vector3(0, 1, 0);

    for (const prop of data.props) {
      const index = seen.get(prop.asset) ?? 0;
      seen.set(prop.asset, index + 1);
      instances.get(prop.asset)!.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);

      expect(position.x).toBeCloseTo(prop.position[0], 3);
      expect(position.y).toBeCloseTo(prop.position[1], 3);
      expect(position.z).toBeCloseTo(prop.position[2], 3);
      expect(scale.x).toBeCloseTo(prop.scale, 3);
      expect(scale.y).toBeCloseTo(prop.scale, 3);
      expect(scale.z).toBeCloseTo(prop.scale, 3);
      expectedRotation.setFromAxisAngle(up, prop.rotationY);
      expect(Math.abs(rotation.dot(expectedRotation))).toBeCloseTo(1, 3);
    }
  });

  it('crea un InstancedMesh por asset con el count correcto', () => {
    const expected = new Map<string, number>();
    for (const prop of data.props) expected.set(prop.asset, (expected.get(prop.asset) ?? 0) + 1);

    expect(data.props.length).toBeGreaterThan(0);
    expect(instances.size).toBe(expected.size);
    for (const [asset, count] of expected) {
      const mesh = instances.get(asset)!;
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.count).toBe(count);
    }
  });

  it('crea el agua dispersa del JSON', () => {
    if (data.water.length === 0) expect(water).toBeNull();
    else expect(water!.geometry.getAttribute('position').count).toBe(data.water.length * 6);
  });

  it('rechaza una versión desconocida', () => {
    expect(() => loadMap({ ...data, version: 2 })).toThrow();
  });
});
