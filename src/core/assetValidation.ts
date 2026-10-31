// Validación de assets glTF antes de entregarlos a GLTFLoader.
// Un archivo con URIs externas haría pedidos de red, así que solo se aceptan embebidos.

const GLB_MAGIC = 0x46546c67; // 'glTF'
const GLB_JSON_CHUNK = 0x4e4f534a; // 'JSON'
const GLB_FILE_HEADER_SIZE = 12;
const GLB_CHUNK_HEADER_SIZE = 8;
const GLB_HEADER_SIZE = GLB_FILE_HEADER_SIZE + GLB_CHUNK_HEADER_SIZE;
const DRACO_EXTENSION = 'KHR_draco_mesh_compression';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmbeddedList(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      isObject(entry) &&
      (entry.uri === undefined || (typeof entry.uri === 'string' && entry.uri.startsWith('data:'))),
  );
}

function usesDraco(gltf: Record<string, unknown>): boolean {
  return [gltf.extensionsUsed, gltf.extensionsRequired].some(
    (list) => Array.isArray(list) && list.includes(DRACO_EXTENSION),
  );
}

function checkManifest(name: string, gltf: unknown): string | null {
  if (!isObject(gltf)) return `${name}: no contiene un objeto glTF.`;
  if (usesDraco(gltf)) {
    return `${name}: usa compresión Draco, que no está soportada. Reexportalo sin Draco.`;
  }
  if (!isEmbeddedList(gltf.buffers) || !isEmbeddedList(gltf.images)) {
    return `${name}: usa archivos .bin o texturas externas. Exportalo como .glb o .gltf autocontenido.`;
  }
  return null;
}

function parseJson(bytes: Uint8Array): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false };
  }
}

/**
 * Recorre todos los chunks. Se rechaza más de un chunk JSON porque GLTFLoader se
 * queda con el último: validar solo el primero dejaría pasar URIs externas.
 */
function checkGlb(name: string, buffer: ArrayBuffer): string | null {
  const invalid = `${name}: no es un GLB válido.`;
  if (buffer.byteLength < GLB_HEADER_SIZE) return invalid;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return invalid;
  if (view.getUint32(16, true) !== GLB_JSON_CHUNK) return invalid;

  let manifest: Uint8Array | null = null;
  let offset = GLB_FILE_HEADER_SIZE;
  while (offset < buffer.byteLength) {
    if (offset + GLB_CHUNK_HEADER_SIZE > buffer.byteLength) return invalid;
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + GLB_CHUNK_HEADER_SIZE;
    if (start + length > buffer.byteLength) return invalid;
    if (type === GLB_JSON_CHUNK) {
      if (manifest) return `${name}: tiene más de un chunk JSON.`;
      manifest = new Uint8Array(buffer, start, length);
    }
    offset = start + length;
  }

  const json = parseJson(manifest ?? new Uint8Array());
  return json.ok ? checkManifest(name, json.value) : invalid;
}

/** Devuelve un mensaje si el archivo no se puede usar, o null si es válido. */
export function validateAsset(name: string, buffer: ArrayBuffer): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.glb')) return checkGlb(name, buffer);
  if (!lower.endsWith('.gltf')) return `${name}: solo se aceptan .glb y .gltf.`;
  const json = parseJson(new Uint8Array(buffer));
  return json.ok ? checkManifest(name, json.value) : `${name}: el .gltf no es JSON válido.`;
}
