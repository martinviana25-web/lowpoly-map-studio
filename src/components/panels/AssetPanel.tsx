import { useGLTF } from '@react-three/drei';
import { useMemo, useState, type DragEvent } from 'react';
import { validateAsset } from '../../core/assetValidation.ts';
import { findProp } from '../../core/propCatalog.ts';
import { useEditorStore } from '../../store/editorStore.ts';

const MAX_ASSET_BYTES = 256 * 1024 * 1024;

async function checkFile(file: File): Promise<string | null> {
  if (file.size > MAX_ASSET_BYTES) return `${file.name}: supera el límite de 256 MB.`;
  try {
    return validateAsset(file.name, await file.arrayBuffer());
  } catch {
    return `${file.name}: no se pudo leer el archivo.`;
  }
}

export function AssetPanel() {
  const assets = useEditorStore((s) => s.assets);
  const addAsset = useEditorStore((s) => s.addAsset);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const map = useEditorStore((s) => s.map);
  const propsRevision = useEditorStore((s) => s.propsRevision);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const missing = useMemo(() => {
    const loaded = new Set(assets.map((a) => a.id));
    const ids = new Set(map.props.map((p) => p.asset));
    return [...ids].filter((id) => !findProp(id) && !loaded.has(id));
  }, [assets, map, propsRevision]);

  const addFiles = async (files: Iterable<File>) => {
    const found: string[] = [];
    for (const file of files) {
      const error = await checkFile(file);
      if (error) found.push(error);
      else addAsset({ id: file.name, url: URL.createObjectURL(file) });
    }
    setErrors(found);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  };

  return (
    <section className="space-y-2 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Assets externos</h2>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`block cursor-pointer rounded border border-dashed p-3 text-center text-xs text-white/60 ${
          dragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/20 hover:border-white/40'
        }`}
      >
        Soltá .glb o .gltf, o hacé clic para elegir
        <input
          type="file"
          accept=".glb,.gltf"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </label>

      {errors.map((error) => (
        <p key={error} role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ))}

      <ul className="space-y-1">
        {assets.map((asset) => (
          <li key={asset.id} className="rounded bg-white/5 px-2 py-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" title={asset.id}>
                {asset.id}
              </span>
              <button
                type="button"
                onClick={() => {
                  useGLTF.clear(asset.url);
                  removeAsset(asset.id);
                }}
                className="text-white/50 hover:text-red-400"
              >
                Quitar
              </button>
            </div>
            {asset.error && <p className="mt-1 text-red-400">No se pudo cargar: {asset.error}</p>}
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <div role="status" className="rounded bg-amber-500/10 p-2 text-xs text-amber-300">
          <p>Faltan assets; se muestran como cajas y se conservan al exportar:</p>
          <ul className="mt-1 list-inside list-disc">
            {missing.map((id) => (
              <li key={id} className="truncate">
                {id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
