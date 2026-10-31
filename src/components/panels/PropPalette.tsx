import { PROP_CATALOG, type PropCategory } from '../../core/propCatalog.ts';
import { useEditorStore } from '../../store/editorStore.ts';

const CATEGORIES: readonly PropCategory[] = ['Vegetación', 'Rocas', 'Estructuras'];

function PropButton({ id, label }: { id: string; label: string }) {
  const selected = useEditorStore((s) => s.selectedAsset === id);
  const setSelectedAsset = useEditorStore((s) => s.setSelectedAsset);
  const setTool = useEditorStore((s) => s.setTool);
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={label}
      onClick={() => {
        setSelectedAsset(id);
        setTool('prop');
      }}
      className={`truncate rounded px-2 py-1.5 text-left text-xs ${
        selected ? 'bg-emerald-600 text-white' : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

export function PropPalette() {
  const assets = useEditorStore((s) => s.assets);
  return (
    <section className="space-y-3 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Props</h2>
      {CATEGORIES.map((category) => (
        <div key={category}>
          <h3 className="mb-1 text-xs text-white/60">{category}</h3>
          <div className="grid grid-cols-2 gap-1">
            {PROP_CATALOG.filter((p) => p.category === category).map((p) => (
              <PropButton key={p.id} id={p.id} label={p.label} />
            ))}
          </div>
        </div>
      ))}
      {assets.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs text-white/60">Importados</h3>
          <div className="grid grid-cols-2 gap-1">
            {assets.map((a) => (
              <PropButton key={a.id} id={a.id} label={a.id} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
