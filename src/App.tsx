import { MapCanvas } from './components/canvas/MapCanvas.tsx';
import { AssetPanel } from './components/panels/AssetPanel.tsx';
import { ElementPanel } from './components/panels/ElementPanel.tsx';
import { MapPanel } from './components/panels/MapPanel.tsx';
import { PropPalette } from './components/panels/PropPalette.tsx';
import { ToolPanel } from './components/panels/ToolPanel.tsx';
import { Toolbar } from './components/panels/Toolbar.tsx';
import { useShortcuts } from './hooks/useShortcuts.ts';
import { useEditorStore } from './store/editorStore.ts';

function StatusBar() {
  const width = useEditorStore((s) => s.map.width);
  const depth = useEditorStore((s) => s.map.depth);
  const props = useEditorStore((s) => s.map.props.length);
  const undoCount = useEditorStore((s) => s.undoStack.length);
  const cursor = useEditorStore((s) => s.cursor);
  return (
    <footer
      className="flex gap-4 border-t border-white/10 bg-[#171a21] px-3 py-1 text-xs tabular-nums text-white/60"
    >
      <span>
        {width} x {depth}
      </span>
      <span>Props: {props}</span>
      <span>Historial: {undoCount}</span>
      <span>
        {cursor
          ? `x ${cursor[0].toFixed(1)}  y ${cursor[1].toFixed(2)}  z ${cursor[2].toFixed(1)}`
          : 'Fuera del mapa'}
      </span>
      <span className="ml-auto">Medio: desplazar · Derecho: rotar · Rueda: zoom</span>
    </footer>
  );
}

export default function App() {
  useShortcuts();
  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-white/10 bg-[#14171d]">
          <ToolPanel />
          <PropPalette />
        </aside>
        <main className="relative min-w-0 flex-1">
          <MapCanvas />
        </main>
        <aside className="w-64 shrink-0 overflow-y-auto border-l border-white/10 bg-[#14171d]">
          <ElementPanel />
          <MapPanel />
          <AssetPanel />
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}
