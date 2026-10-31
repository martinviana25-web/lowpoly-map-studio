# Consumir un mapa en Godot 4

1. Copiá `examples/godot/lowpoly_map_importer.gd` a tu proyecto y el JSON del mapa a `res://`.
2. Agregá un `Node3D` con ese script.
3. Indicá el JSON en `Map Path`.
4. Opcional: completá `Asset Meshes` con el nombre del asset como clave y un `Mesh` como valor.
   Lo que falte se dibuja como caja.
5. Agregá una luz (`DirectionalLight3D`) y corré la escena.

Para construir el mapa desde otro script, desactivá `Build On Ready` y llamá a
`importer.build("res://mapa.json")`, que devuelve `false` si el archivo es inválido.

## Por qué no GridMap

`GridMap` coloca piezas de una `MeshLibrary` sobre una grilla de celdas iguales. El terreno del
mapa es continuo: cada celda tiene cuatro alturas propias, así que habría que generar una pieza
por cada combinación. Los props tampoco encajan, porque tienen posición, rotación y escala libres.

Por eso el importador usa:

- `ArrayMesh` para terreno y agua: una sola malla con color por vértice.
- `MultiMeshInstance3D` por asset: instancing con transformación libre por objeto.

## Orden de los triángulos

Godot y el JSON son Y-up, y `rotationY` significa lo mismo en ambos. La diferencia es que Godot
toma como cara frontal el orden horario, mientras que Three usa el antihorario. El importador
invierte el orden: Three usa `a-c-b` y `b-c-d`; Godot, `a-b-c` y `b-d-c`.
