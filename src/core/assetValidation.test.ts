import { describe, expect, it } from 'vitest';
import { validateAsset } from './assetValidation.ts';

function bytes(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}

function glb(manifest: unknown, chunkType = 0x4e4f534a, declaredLength?: number): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const buffer = new ArrayBuffer(20 + json.length);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, declaredLength ?? json.length, true);
  view.setUint32(16, chunkType, true);
  new Uint8Array(buffer).set(json, 20);
  return buffer;
}

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function text(manifest: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(manifest));
}

function chunks(...parts: [number, Uint8Array][]): ArrayBuffer {
  const size = parts.reduce((sum, [, data]) => sum + 8 + data.length, 12);
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, size, true);
  let offset = 12;
  for (const [type, data] of parts) {
    view.setUint32(offset, data.length, true);
    view.setUint32(offset + 4, type, true);
    new Uint8Array(buffer).set(data, offset + 8);
    offset += 8 + data.length;
  }
  return buffer;
}

const embedded = { buffers: [{ uri: 'data:application/octet-stream;base64,AA==' }], images: [{ bufferView: 0 }] };

describe('validateAsset', () => {
  it('acepta .gltf embebido y .glb sin URIs externas', () => {
    expect(validateAsset('a.gltf', bytes(JSON.stringify(embedded)))).toBeNull();
    expect(validateAsset('a.GLB', glb({ buffers: [{ byteLength: 4 }] }))).toBeNull();
  });

  it('rechaza extensiones desconocidas', () => {
    expect(validateAsset('a.obj', bytes('x'))).toContain('solo se aceptan');
  });

  it('rechaza URIs externas en .gltf y dentro del chunk JSON de .glb', () => {
    for (const manifest of [{ buffers: [{ uri: 'x.bin' }] }, { images: [{ uri: 'https://a.test/t.png' }] }]) {
      expect(validateAsset('a.gltf', bytes(JSON.stringify(manifest)))).toContain('externas');
      expect(validateAsset('a.glb', glb(manifest))).toContain('externas');
    }
  });

  it('acepta un GLB con chunk BIN después del JSON', () => {
    const file = chunks([JSON_CHUNK, text({ buffers: [{ byteLength: 4 }] })], [BIN_CHUNK, new Uint8Array(4)]);
    expect(validateAsset('a.glb', file)).toBeNull();
  });

  it('rechaza un segundo chunk JSON, que GLTFLoader usaría en lugar del primero', () => {
    const outer = text({ buffers: [{ byteLength: 4 }] });
    const inner = text({ buffers: [{ uri: 'https://a.test/x.bin' }] });
    const bin = new Uint8Array(4);
    expect(validateAsset('a.glb', chunks([JSON_CHUNK, outer], [JSON_CHUNK, inner]))).toContain('más de un chunk');
    expect(validateAsset('a.glb', chunks([JSON_CHUNK, outer], [BIN_CHUNK, bin], [JSON_CHUNK, inner]))).toContain(
      'más de un chunk',
    );
  });

  it('rechaza chunks truncados después del primero', () => {
    const file = chunks([JSON_CHUNK, text({})], [BIN_CHUNK, new Uint8Array(4)]);
    expect(validateAsset('a.glb', file.slice(0, file.byteLength - 2))).toContain('GLB');
    expect(validateAsset('a.glb', file.slice(0, file.byteLength - 6))).toContain('GLB');
  });

  it('rechaza Draco con un mensaje claro', () => {
    const manifest = { extensionsRequired: ['KHR_draco_mesh_compression'] };
    expect(validateAsset('a.gltf', bytes(JSON.stringify(manifest)))).toContain('Draco');
    expect(validateAsset('a.glb', glb({ extensionsUsed: ['KHR_draco_mesh_compression'] }))).toContain('Draco');
  });

  it.each([
    ['null', 'null'],
    ['lista', '[]'],
    ['buffers no lista', '{"buffers":{}}'],
    ['buffer null', '{"buffers":[null]}'],
    ['uri no texto', '{"images":[{"uri":5}]}'],
  ])('rechaza sin lanzar un manifiesto mal formado: %s', (_, text) => {
    expect(validateAsset('a.gltf', bytes(text))).not.toBeNull();
    expect(validateAsset('a.glb', glb(JSON.parse(text)))).not.toBeNull();
  });

  it('rechaza JSON roto y GLB corruptos', () => {
    expect(validateAsset('a.gltf', bytes('{nope'))).toContain('JSON');
    expect(validateAsset('a.glb', bytes('nada'))).toContain('GLB');
    expect(validateAsset('a.glb', bytes('x'.repeat(40)))).toContain('GLB');
    expect(validateAsset('a.glb', glb({}, 0x12345678))).toContain('GLB');
    expect(validateAsset('a.glb', glb({}, undefined, 9999))).toContain('GLB');
  });
});
