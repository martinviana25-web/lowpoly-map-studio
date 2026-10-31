# Formato de mapa (versión 1)

Archivo JSON por capas. Coordenadas Y-up, celda de `cellSize` = 1 unidad. El terreno ocupa
`x` en `[0, width]` y `z` en `[0, depth]`.

```json
{
  "version": 1,
  "metadata": { "name": "Mapa", "width": 64, "depth": 64, "cellSize": 1, "createdAt": "2026-10-30T00:00:00.000Z" },
  "terrain": {
    "heights": [1.25, 1.3],
    "biomes": [0, 0],
    "biomePalette": ["pasto", "arena", "roca", "pantano", "nieve", "agua"]
  },
  "water": [[12, 30, 0.5]],
  "props": [{ "asset": "arbol", "position": [10.5, 2.1, 7.25], "rotationY": 1.57, "scale": 1 }]
}
```

| Campo | Contenido |
|---|---|
| `terrain.heights` | Altura por vértice, plana y row-major: `(width+1)*(depth+1)` valores, índice `z*(width+1)+x`. Rango -8 a 32, 3 decimales. |
| `terrain.biomes` | Índice de `biomePalette` por celda, row-major: `width*depth` valores, índice `z*width+x`. |
| `water` | Lista dispersa de celdas con agua: `[x, z, nivel]`. |
| `props[].asset` | Id del catálogo (`arbol`, `pino`, `arbusto`, `flor`, `roca-chica`, `roca-grande`, `casa`, `torre`, `muro`) o nombre de archivo de un asset importado. |
| `props[].position` | Base del objeto en `[x, y, z]`. |
| `props[].rotationY` | Radianes alrededor de Y. |
| `props[].scale` | Escala uniforme. |

Los assets externos no viajan dentro del JSON: se referencian por nombre y hay que volver a
cargarlos en cada sesión. Un prop cuyo asset no esté cargado se ve como caja y se conserva al
reexportar.

Límites al importar: archivo de hasta 64 MB; 200.000 props; 256 assets distintos; 256 caracteres
por texto; niveles y alturas de props entre -9 y 33; props a no más de 1 unidad fuera del mapa;
`scale` entre 0.001 y 1000; `rotationY` entre -1000 y 1000.

Cada celda son dos triángulos con la diagonal entre `(x+1, z)` y `(x, z+1)`.
