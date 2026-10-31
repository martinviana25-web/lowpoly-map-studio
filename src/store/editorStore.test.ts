import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_LIMIT } from '../core/history.ts';
import { BIOME, type MapData } from '../core/types.ts';
import { useEditorStore } from './editorStore.ts';

const store = useEditorStore;

function snapshot(map: MapData): Buffer[] {
  return [map.heights, map.biomes, map.water].map((a) => Buffer.from(a.buffer.slice(0)));
}

function strokeAcross(x0: number, x1: number): void {
  const s = store.getState();
  s.beginStroke(x0, 30);
  for (let x = x0; x <= x1; x++) s.strokeAt(x, 30);
  s.endStroke();
}

beforeEach(() => {
  store.getState().newMap({ width: 64, depth: 64, seed: 5, createdAt: 'x' });
  store.setState({ tool: 'raise', brush: { radius: 4, strength: 0.5, hardness: 0.3 } });
  store.getState().consumeDirtyRect();
});

describe('strokes', () => {
  it('un stroke es una entrada; undo restaura byte a byte y redo reaplica', () => {
    const { map } = store.getState();
    const before = snapshot(map);

    strokeAcross(20, 30);
    expect(store.getState().undoStack).toHaveLength(1);
    const after = snapshot(map);
    expect(after[0].equals(before[0])).toBe(false);

    store.getState().undo();
    expect(snapshot(map)).toEqual(before);
    expect(store.getState().redoStack).toHaveLength(1);

    store.getState().redo();
    expect(snapshot(map)).toEqual(after);
    expect(store.getState().undoStack).toHaveLength(1);
  });

  it('heights, biomes y water vuelven byte a byte en strokes mezclados', () => {
    const { map } = store.getState();
    const before = snapshot(map);

    strokeAcross(10, 20);
    store.setState({ tool: 'biome', biome: BIOME.agua });
    strokeAcross(12, 18);
    store.setState({ biome: BIOME.roca });
    strokeAcross(14, 16);
    store.setState({ tool: 'flatten' });
    strokeAcross(11, 13);
    const after = snapshot(map);

    expect(after[0].equals(before[0])).toBe(false);
    expect(after[1].equals(before[1])).toBe(false);
    expect(after[2].equals(before[2])).toBe(false);
    expect(store.getState().undoStack).toHaveLength(4);

    const { undo, redo } = store.getState();
    for (let i = 0; i < 4; i++) undo();
    expect(snapshot(map)).toEqual(before);
    for (let i = 0; i < 4; i++) redo();
    expect(snapshot(map)).toEqual(after);
  });

  it('un stroke de lower baja el terreno y undo lo restaura', () => {
    const { map } = store.getState();
    const before = snapshot(map);
    const center = 30 * 65 + 20;
    const height = map.heights[center];

    store.setState({ tool: 'lower' });
    strokeAcross(20, 20);
    expect(map.heights[center]).toBeLessThan(height);

    store.getState().undo();
    expect(snapshot(map)).toEqual(before);
  });

  it('flatten usa la altura muestreada al iniciar el stroke', () => {
    const { map } = store.getState();
    store.setState({ tool: 'flatten', brush: { radius: 3, strength: 1, hardness: 1 } });
    const s = store.getState();
    s.beginStroke(10, 10);
    const target = map.heights[10 * 65 + 10];
    s.strokeAt(30, 30);
    s.endStroke();
    expect(map.heights[30 * 65 + 30]).toBeCloseTo(target);
  });

  it('un stroke nuevo vacía redo y el historial se limita a 100', () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) strokeAcross(20, 20);
    expect(store.getState().undoStack).toHaveLength(HISTORY_LIMIT);
    store.getState().undo();
    strokeAcross(25, 25);
    expect(store.getState().redoStack).toHaveLength(0);
  });

  it('marca revisión y rectángulo sucio, también al deshacer', () => {
    const start = store.getState().terrainRevision;
    strokeAcross(20, 22);
    expect(store.getState().terrainRevision).toBeGreaterThan(start);
    const rect = store.getState().consumeDirtyRect();
    expect(rect).not.toBeNull();
    expect(store.getState().consumeDirtyRect()).toBeNull();

    store.getState().undo();
    expect(store.getState().consumeDirtyRect()).toEqual(rect);
  });
});

describe('props', () => {
  it('coloca sobre el terreno, borra por radio y deshace', () => {
    store.setState({ selectedAsset: 'casa', placement: { rotationY: 1, scale: 2, randomize: false } });
    const s = store.getState();
    s.placeProp(10.5, 10.5);
    const { map } = store.getState();
    expect(map.props).toHaveLength(1);
    expect(map.props[0]).toMatchObject({ asset: 'casa', rotationY: 1, scale: 2 });
    expect(map.props[0].position[1]).toBeCloseTo(map.heights[10 * 65 + 10], 0);

    s.removeProp(40, 40);
    expect(map.props).toHaveLength(1);
    s.removeProp(11, 10);
    expect(map.props).toHaveLength(0);

    s.undo();
    expect(map.props).toHaveLength(1);
    s.undo();
    expect(map.props).toHaveLength(0);
    s.redo();
    expect(map.props).toHaveLength(1);
  });
});

describe('elementos individuales', () => {
  const place = () => {
    store.getState().placeProp(10.5, 10.5);
    return store.getState().map.props.at(-1)!;
  };

  it('asigna ids únicos y borra por id con undo', () => {
    const a = place();
    const b = place();
    expect(a.id).not.toBe(b.id);
    store.getState().selectProp(a.id);
    store.getState().deleteProp(a.id);
    expect(store.getState().selectedPropId).toBeNull();
    expect(store.getState().map.props.map((p) => p.id)).toEqual([b.id]);
    store.getState().undo();
    expect(store.getState().map.props.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('selecciona por clic y se limpia si undo elimina el elemento', () => {
    const a = place();
    // rayo vertical hacia abajo sobre el elemento
    store.getState().selectPropByRay([10.5, 20, 10.5], [0, -1, 0]);
    expect(store.getState().selectedPropId).toBe(a.id);
    store.getState().undo();
    expect(store.getState().selectedPropId).toBeNull();
  });

  it('funde ediciones seguidas en una entrada y deshace al valor original', () => {
    const a = place();
    const start = store.getState().undoStack.length;
    store.getState().updateProp(a.id, { scale: 2 });
    store.getState().updateProp(a.id, { scale: 3 });
    store.getState().updateProp(a.id, { colors: ['#ff0000', '#00ff00'] });
    expect(store.getState().undoStack).toHaveLength(start + 1);
    expect(store.getState().map.props[0]).toMatchObject({ scale: 3, colors: ['#ff0000', '#00ff00'] });
    store.getState().undo();
    expect(store.getState().map.props[0]).toEqual(a);
    store.getState().redo();
    expect(store.getState().map.props[0].scale).toBe(3);
  });

  it('el undo de un alta sigue funcionando tras editar el elemento', () => {
    const a = place();
    store.getState().updateProp(a.id, { rotationY: 1 });
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().map.props).toHaveLength(0);
  });
});

describe('newMap y loadMap', () => {
  it('limpian el historial', () => {
    strokeAcross(20, 22);
    store.getState().newMap({ width: 64, depth: 64, seed: 6 });
    expect(store.getState().undoStack).toHaveLength(0);
    expect(store.getState().redoStack).toHaveLength(0);
  });
});
