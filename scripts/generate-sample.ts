// Genera examples/sample-map.json. Es determinista: seed y fecha fijas.
import { writeFileSync } from 'node:fs';
import { serializeMap } from '../src/core/exporter.ts';
import { generateMap, sampleHeight } from '../src/core/heightmap.ts';
import { mulberry32 } from '../src/core/prng.ts';
import { PROP_CATALOG } from '../src/core/propCatalog.ts';
import { BIOME, cellIndex } from '../src/core/types.ts';

const SEED = 20261030;
const PROP_COUNT = 60;

const map = generateMap({
  name: 'Mapa de ejemplo',
  width: 64,
  depth: 64,
  seed: SEED,
  createdAt: '2026-10-30T00:00:00.000Z',
});

const random = mulberry32(SEED + 1);
while (map.props.length < PROP_COUNT) {
  const x = random() * map.width;
  const z = random() * map.depth;
  const rotationY = random() * Math.PI * 2;
  const scale = 0.8 + random() * 0.4;
  const asset = PROP_CATALOG[Math.floor(random() * PROP_CATALOG.length)].id;
  if (map.biomes[cellIndex(map, Math.floor(x), Math.floor(z))] === BIOME.agua) continue;
  map.props.push({ id: `p-${map.props.length}`, asset, position: [x, sampleHeight(map, x, z), z], rotationY, scale });
}

const target = new URL('../examples/sample-map.json', import.meta.url);
writeFileSync(target, `${serializeMap(map)}\n`);
console.log(`Escrito ${target.pathname}`);
