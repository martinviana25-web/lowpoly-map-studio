import { useEditorStore, type Tool } from '../../store/editorStore.ts';

const TOOLS: readonly { id: Tool; label: string }[] = [
  { id: 'raise', label: 'Elevar' },
  { id: 'lower', label: 'Bajar' },
  { id: 'flatten', label: 'Aplanar' },
  { id: 'biome', label: 'Bioma' },
  { id: 'prop', label: 'Colocar' },
  { id: 'erase', label: 'Borrar' },
];

const BUTTON = 'rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-40';

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);

  return (
    <header className="flex items-center gap-1 border-b border-white/10 bg-[#171a21] px-3 py-2">
      <h1 className="mr-4 text-sm font-semibold tracking-wide">LowPoly Map Studio</h1>
      {TOOLS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={tool === id}
          onClick={() => setTool(id)}
          className={`${BUTTON} ${
            tool === id ? 'bg-emerald-600 text-white' : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          {label}
        </button>
      ))}
      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Ctrl+Z"
          className={`${BUTTON} bg-white/5 hover:bg-white/10`}
        >
          Deshacer
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Ctrl+Y"
          className={`${BUTTON} bg-white/5 hover:bg-white/10`}
        >
          Rehacer
        </button>
      </div>
    </header>
  );
}
