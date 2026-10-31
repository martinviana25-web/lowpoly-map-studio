import { BIOMES } from '../../core/biomes.ts';
import { isBrushTool, useEditorStore } from '../../store/editorStore.ts';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <label className="block text-xs text-white/70">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-emerald-500"
      />
    </label>
  );
}

export function ToolPanel() {
  const tool = useEditorStore((s) => s.tool);
  const brush = useEditorStore((s) => s.brush);
  const setBrush = useEditorStore((s) => s.setBrush);
  const biome = useEditorStore((s) => s.biome);
  const setBiome = useEditorStore((s) => s.setBiome);
  const placement = useEditorStore((s) => s.placement);
  const setPlacement = useEditorStore((s) => s.setPlacement);

  return (
    <section className="space-y-3 border-b border-white/10 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Herramienta</h2>

      {isBrushTool(tool) && (
        <Slider
          label="Radio"
          value={brush.radius}
          min={1}
          max={32}
          step={0.5}
          onChange={(radius) => setBrush({ radius })}
        />
      )}
      {isBrushTool(tool) && tool !== 'biome' && (
        <>
          <Slider
            label="Fuerza"
            value={brush.strength}
            min={0.02}
            max={1}
            step={0.01}
            onChange={(strength) => setBrush({ strength })}
          />
          <Slider
            label="Dureza del borde"
            value={brush.hardness}
            min={0}
            max={1}
            step={0.01}
            onChange={(hardness) => setBrush({ hardness })}
          />
        </>
      )}

      {tool === 'biome' && (
        <div className="grid grid-cols-2 gap-1">
          {BIOMES.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={biome === b.id}
              onClick={() => setBiome(b.id)}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                biome === b.id ? 'bg-white/15 ring-1 ring-emerald-500' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span
                className="size-3 rounded-sm"
                style={{ backgroundColor: `#${b.color.toString(16).padStart(6, '0')}` }}
              />
              {b.label}
            </button>
          ))}
        </div>
      )}

      {tool === 'prop' && (
        <>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={placement.randomize}
              onChange={(e) => setPlacement({ randomize: e.target.checked })}
              className="accent-emerald-500"
            />
            Rotación y escala aleatorias
          </label>
          <Slider
            label="Escala"
            value={placement.scale}
            min={0.25}
            max={4}
            step={0.05}
            onChange={(scale) => setPlacement({ scale })}
          />
          {!placement.randomize && (
            <Slider
              label="Rotación Y (rad)"
              value={placement.rotationY}
              min={0}
              max={6.28}
              step={0.01}
              onChange={(rotationY) => setPlacement({ rotationY })}
            />
          )}
        </>
      )}

      {tool === 'erase' && (
        <p className="text-xs text-white/60">Hacé clic cerca de un prop para quitarlo.</p>
      )}
    </section>
  );
}
