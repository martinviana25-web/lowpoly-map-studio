import { useState, type ChangeEvent } from 'react';
import { MAX_TEXT_LENGTH, parseMap, serializeMap } from '../../core/exporter.ts';
import { DEFAULT_MAP_SIZE, MAP_SIZES } from '../../core/types.ts';
import { useEditorStore } from '../../store/editorStore.ts';

const INPUT = 'mt-1 w-full rounded bg-white/5 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-emerald-500';
const BUTTON = 'w-full rounded bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10';

const MAX_MAP_BYTES = 64 * 1024 * 1024;

function downloadMap(): void {
  const { map } = useEditorStore.getState();
  const blob = new Blob([serializeMap(map)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${map.name.trim().replace(/\s+/g, '-') || 'mapa'}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function MapPanel() {
  const newMap = useEditorStore((s) => s.newMap);
  const loadMap = useEditorStore((s) => s.loadMap);
  const currentName = useEditorStore((s) => s.map.name);
  const [name, setName] = useState('Mapa nuevo');
  const [seed, setSeed] = useState(1234);
  const [size, setSize] = useState<number>(DEFAULT_MAP_SIZE);
  const [error, setError] = useState<string | null>(null);

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_MAP_BYTES) {
      setError(`${file.name}: supera el límite de 64 MB.`);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError(`${file.name}: no se pudo leer el archivo.`);
      return;
    }
    const result = parseMap(text);
    if (result.ok) {
      setError(null);
      loadMap(result.map);
    } else {
      setError(`${file.name}: ${result.error}`);
    }
  };

  return (
    <section className="space-y-2 border-b border-white/10 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Mapa</h2>
      <p className="truncate text-xs text-white/60" title={currentName}>
        Abierto: {currentName}
      </p>
      <label className="block text-xs text-white/70">
        Nombre
        <input
          value={name}
          maxLength={MAX_TEXT_LENGTH}
          onChange={(e) => setName(e.target.value)}
          className={INPUT}
        />
      </label>
      <div className="flex gap-2">
        <label className="block flex-1 text-xs text-white/70">
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className={INPUT}
          />
        </label>
        <label className="block flex-1 text-xs text-white/70">
          Tamaño
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className={`${INPUT} [&>option]:bg-[#171a21]`}
          >
            {MAP_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} x {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className={BUTTON}
        onClick={() => newMap({ name, seed, width: size, depth: size })}
      >
        Nuevo mapa
      </button>
      <button type="button" className={BUTTON} onClick={downloadMap}>
        Exportar JSON
      </button>
      <label className={`${BUTTON} block cursor-pointer text-center`}>
        Importar JSON
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void onImport(e)}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
