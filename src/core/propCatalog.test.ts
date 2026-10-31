import { describe, expect, it } from 'vitest';
import { PROP_CATALOG, createPieceGeometry, findProp } from './propCatalog.ts';

describe('propCatalog', () => {
  it('tiene ids únicos y los nueve props integrados', () => {
    expect(new Set(PROP_CATALOG.map((p) => p.id)).size).toBe(9);
    expect(findProp('casa')?.label).toBe('Casa');
    expect(findProp('nada')).toBeUndefined();
  });

  it('cada prop apoya en el suelo, con las rocas apenas enterradas', () => {
    for (const def of PROP_CATALOG) {
      const lowest = Math.min(
        ...def.pieces.map((piece) => {
          const geometry = createPieceGeometry(piece);
          geometry.computeBoundingBox();
          return geometry.boundingBox!.min.y;
        }),
      );
      expect(lowest).toBeGreaterThanOrEqual(-0.15);
      expect(lowest).toBeLessThan(0.3);
    }
  });
});
