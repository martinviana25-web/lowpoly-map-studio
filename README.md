# LowPoly Map Studio

Editor web de código abierto para diseñar mapas 3D low-poly orientados a juegos cenitales, web
games y survivors. Corre entero en el navegador, sin backend: se colabora compartiendo el repo y
los archivos JSON de los mapas.

**App publicada:** https://martinviana25-web.github.io/lowpoly-map-studio/

## Funciones

- Pinceles para elevar, bajar y aplanar terreno, con radio, fuerza y dureza de borde.
- Pintura de biomas: pasto, arena, roca, pantano, nieve y agua.
- Catálogo de props low-poly: vegetación, rocas y estructuras.
- Importación de `.glb` y `.gltf` autocontenidos, compatibles con Kenney o LUDO.AI. No se aceptan
  archivos con URIs externas ni compresión Draco; el límite es 256 MB por asset.
- Undo/redo por diffs, con un límite de 100 pasos.
- Export e import JSON versionado, con ejemplos para Three.js y Godot 4.

## Comandos

Requiere Node 22.12+, 24 o 26 (`.nvmrc` indica 26).

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck y build en `dist/` |
| `npm run preview` | Sirve el build |
| `npm run typecheck` | Solo `tsc` |
| `npm test` | Tests con Vitest |
| `npm run gen:sample` | Regenera `examples/sample-map.json` |

## Controles

| Entrada | Acción |
|---|---|
| Botón izquierdo | Usar la herramienta activa |
| Botón medio | Desplazar |
| Botón derecho | Rotar |
| Rueda | Zoom |
| Ctrl+Z | Deshacer |
| Ctrl+Y o Ctrl+Shift+Z | Rehacer |

## Estructura

```
src/
  core/        Lógica pura y testeada: heightmap, pinceles, historial, raycast, malla, exporter
  store/       Store de Zustand
  components/
    canvas/    Escena de React Three Fiber
    panels/    Interfaz
  hooks/       Atajos de teclado
scripts/       Generador del mapa de ejemplo
examples/      Mapa de ejemplo y cargadores para Three.js y Godot
docs/          Formato del JSON y guías de consumo
.github/       CI y deploy a GitHub Pages
```

## Arquitectura

- **Modelo:** los mapas usan typed arrays: alturas por vértice, bioma y agua por celda.
- **Reactividad:** los arrays se mutan in-place. React solo se suscribe a contadores de revisión,
  y el rectángulo sucio indica qué parte de la malla reescribir.
- **Pinceles:** son funciones puras que devuelven una edición. `StrokeRecorder` la aplica y guarda
  el valor anterior de cada índice, de modo que un stroke entero es una sola entrada de historial.
- **Malla:** es no indexada, con 6 vértices por celda, y sube a la GPU solo los rangos modificados.
- **Picking:** usa ray-marching propio sobre el heightfield, sin `Mesh.raycast` ni BVH.
- **Props:** el catálogo usa un `InstancedMesh` por pieza de asset.

## Consumir los mapas

- [Formato del JSON](docs/map-format.md)
- [Three.js](docs/consumir-en-threejs.md)
- [Godot 4](docs/consumir-en-godot.md)

## Licencia

[MIT](LICENSE)
