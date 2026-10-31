import type { BrushEdit, ChannelEdit } from './brushes.ts';
import { mergeRects, type CellRect, type MapData, type PropInstance } from './types.ts';

export const HISTORY_LIMIT = 100;

export interface FloatChannelDelta {
  indices: Uint32Array;
  before: Float32Array;
  after: Float32Array;
}

export interface ByteChannelDelta {
  indices: Uint32Array;
  before: Uint8Array;
  after: Uint8Array;
}

export interface TerrainDelta {
  kind: 'terrain';
  heights: FloatChannelDelta;
  biomes: ByteChannelDelta;
  water: FloatChannelDelta;
  rect: CellRect;
}

export interface PropsDelta {
  kind: 'props';
  added: PropInstance[];
  removed: PropInstance[];
}

export type HistoryEntry = TerrainDelta | PropsDelta;

/** Guarda el "antes" la primera vez que el stroke toca cada índice. */
function applyChannel(
  target: Float32Array | Uint8Array,
  edit: ChannelEdit,
  before: Map<number, number>,
): void {
  for (let n = 0; n < edit.indices.length; n++) {
    const i = edit.indices[n];
    if (!before.has(i)) before.set(i, target[i]);
    target[i] = edit.values[n];
  }
}

function changedIndices(target: Float32Array | Uint8Array, before: Map<number, number>): number[] {
  const out: number[] = [];
  for (const [i, value] of before) {
    if (!Object.is(target[i], value)) out.push(i);
  }
  return out.sort((a, b) => a - b);
}

function floatDelta(target: Float32Array, before: Map<number, number>): FloatChannelDelta {
  const changed = changedIndices(target, before);
  return {
    indices: Uint32Array.from(changed),
    before: Float32Array.from(changed, (i) => before.get(i)!),
    after: Float32Array.from(changed, (i) => target[i]),
  };
}

function byteDelta(target: Uint8Array, before: Map<number, number>): ByteChannelDelta {
  const changed = changedIndices(target, before);
  return {
    indices: Uint32Array.from(changed),
    before: Uint8Array.from(changed, (i) => before.get(i)!),
    after: Uint8Array.from(changed, (i) => target[i]),
  };
}

/** Acumula las aplicaciones de un stroke y las condensa en una sola entrada. */
export class StrokeRecorder {
  private heights = new Map<number, number>();
  private biomes = new Map<number, number>();
  private water = new Map<number, number>();
  private rect: CellRect | null = null;

  apply(map: MapData, edit: BrushEdit): void {
    applyChannel(map.heights, edit.heights, this.heights);
    applyChannel(map.biomes, edit.biomes, this.biomes);
    applyChannel(map.water, edit.water, this.water);
    this.rect = mergeRects(this.rect, edit.rect);
  }

  /** Devuelve el delta del stroke, o null si no cambió nada. */
  finish(map: MapData): TerrainDelta | null {
    if (!this.rect) return null;
    const heights = floatDelta(map.heights, this.heights);
    const biomes = byteDelta(map.biomes, this.biomes);
    const water = floatDelta(map.water, this.water);
    if (heights.indices.length + biomes.indices.length + water.indices.length === 0) return null;
    return { kind: 'terrain', heights, biomes, water, rect: this.rect };
  }
}

export interface ApplyResult {
  rect: CellRect | null;
  waterChanged: boolean;
  propsChanged: boolean;
}

/** Aplica una entrada en `dir`: 'undo' escribe el antes, 'redo' el después. */
export function applyEntry(map: MapData, entry: HistoryEntry, dir: 'undo' | 'redo'): ApplyResult {
  if (entry.kind === 'props') {
    const add = dir === 'undo' ? entry.removed : entry.added;
    const drop = new Set(dir === 'undo' ? entry.added : entry.removed);
    map.props = map.props.filter((p) => !drop.has(p)).concat(add);
    return { rect: null, waterChanged: false, propsChanged: true };
  }
  for (const [target, delta] of [
    [map.heights, entry.heights],
    [map.biomes, entry.biomes],
    [map.water, entry.water],
  ] as const) {
    const source = dir === 'undo' ? delta.before : delta.after;
    for (let n = 0; n < delta.indices.length; n++) target[delta.indices[n]] = source[n];
  }
  return { rect: entry.rect, waterChanged: entry.water.indices.length > 0, propsChanged: false };
}

/** Agrega al final y descarta lo más viejo por encima del límite. */
export function pushEntry(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...stack, entry];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/** Bytes que ocupan los arrays del delta. */
export function deltaByteSize(delta: TerrainDelta): number {
  return [delta.heights, delta.biomes, delta.water].reduce(
    (sum, c) => sum + c.indices.byteLength + c.before.byteLength + c.after.byteLength,
    0,
  );
}
