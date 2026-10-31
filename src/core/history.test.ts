import { describe, expect, it } from 'vitest';
import { lower, raise } from './brushes.ts';
import { createFlatMap } from './heightmap.ts';
import {
  HISTORY_LIMIT,
  StrokeRecorder,
  applyEntry,
  deltaByteSize,
  pushEntry,
  type HistoryEntry,
} from './history.ts';
import type { PropInstance } from './types.ts';

const brush = { radius: 3, strength: 0.5, hardness: 0.5 };

describe('StrokeRecorder', () => {
  it('captura el antes solo la primera vez que toca un índice', () => {
    const map = createFlatMap('t', 32, 32);
    const recorder = new StrokeRecorder();
    recorder.apply(map, raise(map, 10, 10, brush));
    recorder.apply(map, raise(map, 10, 10, brush));
    const delta = recorder.finish(map)!;
    expect(new Set(delta.heights.before)).toEqual(new Set([1]));
  });

  it('devuelve null si no hubo cambios netos', () => {
    const map = createFlatMap('t', 8, 8);
    const recorder = new StrokeRecorder();
    expect(recorder.finish(map)).toBeNull();
  });

  it('devuelve null si una edición neutra deja todo como estaba', () => {
    const map = createFlatMap('t', 32, 32);
    const hard = { radius: 3, strength: 0.5, hardness: 1 };
    const recorder = new StrokeRecorder();
    recorder.apply(map, raise(map, 10, 10, hard));
    recorder.apply(map, lower(map, 10, 10, hard));
    expect(recorder.finish(map)).toBeNull();
  });

  it('la memoria del delta es proporcional a los índices tocados, no al mapa', () => {
    const size = (mapSize: number): number => {
      const map = createFlatMap('t', mapSize, mapSize);
      const recorder = new StrokeRecorder();
      recorder.apply(map, raise(map, 20, 20, brush));
      return deltaByteSize(recorder.finish(map)!);
    };
    const small = size(64);
    expect(size(256)).toBe(small);

    const map = createFlatMap('t', 64, 64);
    const recorder = new StrokeRecorder();
    recorder.apply(map, raise(map, 20, 20, brush));
    const delta = recorder.finish(map)!;
    expect(deltaByteSize(delta)).toBe(delta.heights.indices.length * 12);
    expect(small).toBeLessThan(map.heights.byteLength / 10);
  });
});

describe('applyEntry', () => {
  it('undo y redo de props restauran la lista', () => {
    const map = createFlatMap('t', 8, 8);
    const prop: PropInstance = { asset: 'arbol', position: [1, 1, 1], rotationY: 0, scale: 1 };
    map.props = [prop];
    const entry: HistoryEntry = { kind: 'props', added: [prop], removed: [] };
    applyEntry(map, entry, 'undo');
    expect(map.props).toEqual([]);
    applyEntry(map, entry, 'redo');
    expect(map.props).toEqual([prop]);
  });
});

describe('pushEntry', () => {
  it(`conserva como mucho ${HISTORY_LIMIT} entradas y descarta las viejas`, () => {
    const entries: HistoryEntry[] = Array.from({ length: HISTORY_LIMIT + 5 }, () => ({
      kind: 'props',
      added: [],
      removed: [],
    }));
    const stack = entries.reduce<HistoryEntry[]>(pushEntry, []);
    expect(stack).toHaveLength(HISTORY_LIMIT);
    expect(stack[0]).toBe(entries[5]);
    expect(stack.at(-1)).toBe(entries.at(-1));
  });
});
