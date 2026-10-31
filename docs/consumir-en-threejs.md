# Consumir un mapa en Three.js

`examples/threejs/loadMap.js` es un módulo ESM que solo depende de `three`. Copialo a tu proyecto.

```js
import { loadMapFromUrl } from './loadMap.js';

const { group } = await loadMapFromUrl('./sample-map.json');
scene.add(group);
```

El resultado trae `group`, `terrain`, `water` (o `null`) e `instances`, un `Map` de asset a
`InstancedMesh`.

## Mallas propias para los props

Por defecto cada asset se dibuja como caja naranja. Pasá `resolveAsset` para usar tu geometría.
Se llama una vez por asset y debe devolver una geometría y un material, porque cada asset es un
único `InstancedMesh`.

```js
const { group } = await loadMapFromUrl('./mapa.json', {
  resolveAsset: (asset) => ({ geometry: geometries[asset], material: materials[asset] }),
});
```

El terreno usa `flatShading` con colores por vértice, así que hace falta al menos una luz en la
escena.
