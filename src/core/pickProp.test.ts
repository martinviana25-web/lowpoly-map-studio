import { describe, expect, it } from 'vitest';
import { pickPropByRay } from './pickProp.ts';
import type { PropInstance } from './types.ts';

const tree: PropInstance = { id: 'a', asset: 'arbol', position: [10, 0, 10], rotationY: 0, scale: 1 };

describe('pickPropByRay', () => {
  // Cámara a 41° de elevación mirando al sur-norte: el rayo pasa por la copa (y=1.5), no por la base.
  const dir: [number, number, number] = [0, -Math.sin(0.72), -Math.cos(0.72)];
  const originFor = (y: number): [number, number, number] => [10, 1.5 + 30 * Math.sin(0.72), 10 + 30 * Math.cos(0.72) + 0 * y];

  it('selecciona al apuntar a la copa aunque el rayo toque el terreno lejos de la base', () => {
    expect(pickPropByRay([tree], originFor(0), dir)).toBe(tree);
  });

  it('devuelve null si el rayo pasa lejos', () => {
    expect(pickPropByRay([tree], [30, 20, 30], dir)).toBeNull();
  });

  it('elige el más cercano al rayo', () => {
    const other = { ...tree, id: 'b', position: [10.5, 0, 10] as [number, number, number] };
    expect(pickPropByRay([other, tree], originFor(0), dir)?.id).toBe('a');
  });
});
