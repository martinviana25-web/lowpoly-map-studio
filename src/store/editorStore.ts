import { create } from 'zustand';
import { flatten, lower, paintBiome, raise, type BrushEdit, type BrushParams } from '../core/brushes.ts';
import { generateMap, sampleHeight, type GenerateParams } from '../core/heightmap.ts';
import {
  StrokeRecorder,
  applyEntry,
  pushEntry,
  type HistoryEntry,
  type PropsDelta,
} from '../core/history.ts';
import { pickPropByRay } from '../core/pickProp.ts';
import { PROP_CATALOG } from '../core/propCatalog.ts';
import {
  BIOME,
  createPropId,
  mergeRects,
  type BiomeId,
  type CellRect,
  type MapData,
  type PropInstance,
} from '../core/types.ts';

export type Tool = 'raise' | 'lower' | 'flatten' | 'biome' | 'prop' | 'erase' | 'select';

export const PICK_RADIUS = 1.5;
/** Ediciones del mismo elemento dentro de esta ventana se funden en una entrada de historial. */
const COALESCE_MS = 700;

export type PropPatch = Partial<Pick<PropInstance, 'scale' | 'rotationY' | 'colors'>>;

export interface ExternalAsset {
  /** Nombre del archivo; es lo que se guarda en el JSON. */
  id: string;
  url: string;
  error?: string;
}

export interface PlacementParams {
  rotationY: number;
  scale: number;
  randomize: boolean;
}

export interface EditorState {
  map: MapData;
  tool: Tool;
  brush: BrushParams;
  biome: BiomeId;
  selectedAsset: string;
  placement: PlacementParams;
  /** Id del elemento seleccionado; null si no hay. */
  selectedPropId: string | null;
  assets: ExternalAsset[];
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  /** Sube cuando cambian heights o biomes; los arrays se mutan in-place. */
  terrainRevision: number;
  waterRevision: number;
  propsRevision: number;
  /** Unión de lo sucio desde el último `consumeDirtyRect`. */
  dirtyRect: CellRect | null;
  /** Posición del puntero sobre el terreno. */
  cursor: readonly [number, number, number] | null;

  setTool: (tool: Tool) => void;
  setBrush: (patch: Partial<BrushParams>) => void;
  setBiome: (biome: BiomeId) => void;
  setSelectedAsset: (id: string) => void;
  setPlacement: (patch: Partial<PlacementParams>) => void;
  setCursor: (cursor: readonly [number, number, number] | null) => void;

  beginStroke: (x: number, z: number) => void;
  strokeAt: (x: number, z: number) => void;
  endStroke: () => void;
  placeProp: (x: number, z: number) => void;
  /** Quita el prop más cercano dentro del radio de pick. */
  removeProp: (x: number, z: number, radius?: number) => void;
  /** Selecciona el elemento más cercano al rayo del puntero (o deselecciona). */
  selectPropByRay: (origin: readonly [number, number, number], direction: readonly [number, number, number]) => void;
  selectProp: (id: string | null) => void;
  /** Edita un elemento; las ediciones seguidas del mismo elemento forman una sola entrada de historial. */
  updateProp: (id: string, patch: PropPatch) => void;
  deleteProp: (id: string) => void;
  undo: () => void;
  redo: () => void;
  newMap: (params: GenerateParams) => void;
  loadMap: (map: MapData) => void;
  consumeDirtyRect: () => CellRect | null;

  addAsset: (asset: ExternalAsset) => void;
  removeAsset: (id: string) => void;
  setAssetError: (id: string, error: string) => void;
}

interface ActiveStroke {
  recorder: StrokeRecorder;
  flattenTarget: number;
}

function findPropAt(map: MapData, x: number, z: number, radius: number): PropInstance | null {
  let nearest: PropInstance | null = null;
  let best = radius;
  for (const prop of map.props) {
    const distance = Math.hypot(prop.position[0] - x, prop.position[2] - z);
    if (distance <= best) {
      best = distance;
      nearest = prop;
    }
  }
  return nearest;
}

const BRUSH_TOOLS: readonly Tool[] = ['raise', 'lower', 'flatten', 'biome'];

export function isBrushTool(tool: Tool): boolean {
  return BRUSH_TOOLS.includes(tool);
}

export const useEditorStore = create<EditorState>((set, get) => {
  // Fuera del estado: nada de React depende del stroke en curso.
  let stroke: ActiveStroke | null = null;
  let lastUpdate: { entry: PropsDelta; at: number } | null = null;

  const computeEdit = (
    state: EditorState,
    active: ActiveStroke,
    x: number,
    z: number,
  ): BrushEdit | null => {
    const { map, brush, tool, biome } = state;
    switch (tool) {
      case 'raise':
        return raise(map, x, z, brush);
      case 'lower':
        return lower(map, x, z, brush);
      case 'flatten':
        return flatten(map, x, z, brush, active.flattenTarget);
      case 'biome':
        return paintBiome(map, x, z, brush.radius, biome);
      default:
        return null;
    }
  };

  const markChanged = (rect: CellRect | null, waterChanged: boolean, propsChanged: boolean): void => {
    set((s) => ({
      terrainRevision: rect ? s.terrainRevision + 1 : s.terrainRevision,
      waterRevision: waterChanged ? s.waterRevision + 1 : s.waterRevision,
      propsRevision: propsChanged ? s.propsRevision + 1 : s.propsRevision,
      dirtyRect: mergeRects(s.dirtyRect, rect),
    }));
  };

  const commit = (entry: HistoryEntry): void => {
    set((s) => ({ undoStack: pushEntry(s.undoStack, entry), redoStack: [] }));
  };

  const afterHistory = (): void => {
    lastUpdate = null;
    const { selectedPropId, map } = get();
    if (selectedPropId && !map.props.some((p) => p.id === selectedPropId)) {
      set({ selectedPropId: null });
    }
  };

  const replaceMap = (map: MapData): void => {
    stroke = null;
    lastUpdate = null;
    set((s) => ({
      map,
      selectedPropId: null,
      undoStack: [],
      redoStack: [],
      dirtyRect: null,
      cursor: null,
      terrainRevision: s.terrainRevision + 1,
      waterRevision: s.waterRevision + 1,
      propsRevision: s.propsRevision + 1,
    }));
  };

  return {
    map: generateMap({ name: 'Mapa nuevo', seed: 1234 }),
    tool: 'raise',
    brush: { radius: 6, strength: 0.25, hardness: 0.3 },
    biome: BIOME.pasto,
    selectedAsset: PROP_CATALOG[0].id,
    placement: { rotationY: 0, scale: 1, randomize: true },
    selectedPropId: null,
    assets: [],
    undoStack: [],
    redoStack: [],
    terrainRevision: 0,
    waterRevision: 0,
    propsRevision: 0,
    dirtyRect: null,
    cursor: null,

    setTool: (tool) => set({ tool }),
    setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
    setBiome: (biome) => set({ biome }),
    setSelectedAsset: (selectedAsset) => set({ selectedAsset }),
    setPlacement: (patch) => set((s) => ({ placement: { ...s.placement, ...patch } })),
    setCursor: (cursor) => set({ cursor }),

    beginStroke: (x, z) => {
      const { tool, map } = get();
      if (!isBrushTool(tool)) return;
      stroke = { recorder: new StrokeRecorder(), flattenTarget: sampleHeight(map, x, z) };
      get().strokeAt(x, z);
    },

    strokeAt: (x, z) => {
      if (!stroke) return;
      const state = get();
      const edit = computeEdit(state, stroke, x, z);
      if (!edit?.rect) return;
      stroke.recorder.apply(state.map, edit);
      markChanged(edit.rect, edit.water.indices.length > 0, false);
    },

    endStroke: () => {
      if (!stroke) return;
      const entry = stroke.recorder.finish(get().map);
      stroke = null;
      if (entry) commit(entry);
    },

    placeProp: (x, z) => {
      const { map, selectedAsset, placement } = get();
      const { randomize, rotationY, scale } = placement;
      const prop: PropInstance = {
        id: createPropId(new Set(map.props.map((p) => p.id))),
        asset: selectedAsset,
        position: [x, sampleHeight(map, x, z), z],
        rotationY: randomize ? Math.random() * Math.PI * 2 : rotationY,
        scale: randomize ? scale * (0.8 + Math.random() * 0.4) : scale,
      };
      map.props = [...map.props, prop];
      commit({ kind: 'props', added: [prop], removed: [] });
      markChanged(null, false, true);
    },

    removeProp: (x, z, radius = PICK_RADIUS) => {
      const nearest = findPropAt(get().map, x, z, radius);
      if (nearest) get().deleteProp(nearest.id);
    },

    selectPropByRay: (origin, direction) => {
      set({ selectedPropId: pickPropByRay(get().map.props, origin, direction)?.id ?? null });
    },

    selectProp: (selectedPropId) => set({ selectedPropId }),

    updateProp: (id, patch) => {
      const { map, undoStack } = get();
      const before = map.props.find((p) => p.id === id);
      if (!before) return;
      const after: PropInstance = { ...before, ...patch };
      map.props = map.props.map((p) => (p === before ? after : p));
      const now = Date.now();
      const top = undoStack.at(-1);
      const merge =
        lastUpdate && top === lastUpdate.entry && now - lastUpdate.at < COALESCE_MS
          ? lastUpdate.entry.updated?.find((u) => u.after.id === id)
          : undefined;
      const entry: PropsDelta = {
        kind: 'props',
        added: [],
        removed: [],
        updated: [{ before: merge?.before ?? before, after }],
      };
      if (merge) set((s) => ({ undoStack: [...s.undoStack.slice(0, -1), entry] }));
      else commit(entry);
      lastUpdate = { entry, at: now };
      markChanged(null, false, true);
    },

    deleteProp: (id) => {
      const { map } = get();
      const prop = map.props.find((p) => p.id === id);
      if (!prop) return;
      map.props = map.props.filter((p) => p !== prop);
      commit({ kind: 'props', added: [], removed: [prop] });
      if (get().selectedPropId === id) set({ selectedPropId: null });
      markChanged(null, false, true);
    },

    undo: () => {
      get().endStroke();
      const { undoStack, redoStack, map } = get();
      const entry = undoStack.at(-1);
      if (!entry) return;
      const result = applyEntry(map, entry, 'undo');
      afterHistory();
      set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, entry] });
      markChanged(result.rect, result.waterChanged, result.propsChanged);
    },

    redo: () => {
      get().endStroke();
      const { undoStack, redoStack, map } = get();
      const entry = redoStack.at(-1);
      if (!entry) return;
      const result = applyEntry(map, entry, 'redo');
      afterHistory();
      set({ undoStack: pushEntry(undoStack, entry), redoStack: redoStack.slice(0, -1) });
      markChanged(result.rect, result.waterChanged, result.propsChanged);
    },

    newMap: (params) => replaceMap(generateMap(params)),
    loadMap: (map) => replaceMap(map),

    consumeDirtyRect: () => {
      const rect = get().dirtyRect;
      if (rect) set({ dirtyRect: null });
      return rect;
    },

    addAsset: (asset) => {
      const previous = get().assets.find((a) => a.id === asset.id);
      if (previous) URL.revokeObjectURL(previous.url);
      set((s) => ({
        assets: [...s.assets.filter((a) => a.id !== asset.id), asset],
        propsRevision: s.propsRevision + 1,
      }));
    },

    removeAsset: (id) => {
      const asset = get().assets.find((a) => a.id === id);
      if (!asset) return;
      URL.revokeObjectURL(asset.url);
      set((s) => ({
        assets: s.assets.filter((a) => a.id !== id),
        selectedAsset: s.selectedAsset === id ? PROP_CATALOG[0].id : s.selectedAsset,
        propsRevision: s.propsRevision + 1,
      }));
    },

    setAssetError: (id, error) => {
      set((s) => ({ assets: s.assets.map((a) => (a.id === id ? { ...a, error } : a)) }));
    },
  };
});
