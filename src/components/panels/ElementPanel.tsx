import { findProp } from '../../core/propCatalog.ts';
import { useEditorStore } from '../../store/editorStore.ts';
import { Slider } from './ToolPanel.tsx';

const MAX_LISTED = 500;
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function Editor({ id }: { id: string }) {
  const prop = useEditorStore((s) => s.map.props.find((p) => p.id === id));
  const updateProp = useEditorStore((s) => s.updateProp);
  const deleteProp = useEditorStore((s) => s.deleteProp);
  if (!prop) return null;
  const pieces = findProp(prop.asset)?.pieces;
  const current = pieces?.map((piece, i) => prop.colors?.[i] ?? hex(piece.color));

  return (
    <div className="space-y-3 border-t border-white/10 pt-3">
      <p className="text-xs text-white/70">
        {findProp(prop.asset)?.label ?? prop.asset} <span className="text-white/40">· {prop.id}</span>
      </p>
      <Slider
        label="Escala"
        value={prop.scale}
        min={0.25}
        max={4}
        step={0.05}
        onChange={(scale) => updateProp(id, { scale })}
      />
      <Slider
        label="Rotación Y (rad)"
        value={prop.rotationY}
        min={0}
        max={6.28}
        step={0.01}
        onChange={(rotationY) => updateProp(id, { rotationY })}
      />
      {current ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-white/70">
            Colores por pieza
            {prop.colors && (
              <button
                type="button"
                onClick={() => updateProp(id, { colors: undefined })}
                className="rounded bg-white/5 px-2 py-0.5 hover:bg-white/10"
              >
                Restaurar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {current.map((color, i) => (
              <input
                key={i}
                type="color"
                aria-label={`Color de la pieza ${i + 1}`}
                value={color}
                onChange={(e) =>
                  updateProp(id, { colors: current.map((c, j) => (j === i ? e.target.value : c)) })
                }
                className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/40">Los assets importados no admiten edición de color.</p>
      )}
      <button
        type="button"
        onClick={() => deleteProp(id)}
        title="Delete"
        className="w-full rounded bg-red-600/80 px-3 py-1.5 text-sm hover:bg-red-600"
      >
        Eliminar elemento
      </button>
    </div>
  );
}

export function ElementPanel() {
  const props = useEditorStore((s) => s.map.props);
  const selected = useEditorStore((s) => s.selectedPropId);
  const selectProp = useEditorStore((s) => s.selectProp);

  return (
    <section className="space-y-2 border-b border-white/10 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
        Elementos ({props.length})
      </h2>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">
        {props.slice(0, MAX_LISTED).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={selected === p.id}
              onClick={() => selectProp(p.id)}
              className={`flex w-full justify-between rounded px-2 py-1 text-left ${
                selected === p.id ? 'bg-white/15 ring-1 ring-emerald-500' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span>{findProp(p.asset)?.label ?? p.asset}</span>
              <span className="text-white/40">{p.id}</span>
            </button>
          </li>
        ))}
        {props.length > MAX_LISTED && (
          <li className="text-white/40">Se muestran los primeros {MAX_LISTED}.</li>
        )}
        {props.length === 0 && <li className="text-white/40">Sin elementos.</li>}
      </ul>
      {selected && <Editor id={selected} />}
    </section>
  );
}
