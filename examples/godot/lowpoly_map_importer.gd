## Importa un mapa de LowPoly Map Studio en Godot 4.
##
## Agregá este script a un Node3D, elegí `map_path` y corré la escena.
## Terreno y agua usan ArrayMesh; cada asset usa un MultiMeshInstance3D.
## Tanto Godot como el JSON son Y-up, pero Godot toma como cara frontal el orden
## horario: por eso los triángulos van invertidos respecto de Three.js.
class_name LowPolyMapImporter
extends Node3D

const SUPPORTED_VERSION := 1

const BIOME_COLORS := {
	"pasto": Color("6fae4f"),
	"arena": Color("dcc98a"),
	"roca": Color("8a8580"),
	"pantano": Color("5a6b3c"),
	"nieve": Color("f0f3f7"),
	"agua": Color("2f6f9f"),
}

@export_file("*.json") var map_path := "res://sample-map.json"
## Asset del JSON (String) -> Mesh. Lo que falte se dibuja como una caja.
@export var asset_meshes: Dictionary = {}
@export var build_on_ready := true


func _ready() -> void:
	if build_on_ready:
		build(map_path)


## Lee el JSON y crea los nodos hijos. Devuelve false si el archivo es inválido.
func build(path: String) -> bool:
	if not FileAccess.file_exists(path):
		push_error("Mapa no encontrado: %s" % path)
		return false
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not data is Dictionary or int(data.get("version", 0)) != SUPPORTED_VERSION:
		push_error("Mapa inválido o versión no soportada: %s" % path)
		return false

	add_child(_build_terrain(data))
	if not data["water"].is_empty():
		add_child(_build_water(data["water"]))
	_build_props(data["props"])
	return true


func _build_terrain(data: Dictionary) -> MeshInstance3D:
	var width: int = data["metadata"]["width"]
	var depth: int = data["metadata"]["depth"]
	var heights: Array = data["terrain"]["heights"]
	var biomes: Array = data["terrain"]["biomes"]
	var palette: Array = data["terrain"]["biomePalette"]
	var stride := width + 1

	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	vertices.resize(width * depth * 6)
	normals.resize(width * depth * 6)
	colors.resize(width * depth * 6)

	var i := 0
	for z in depth:
		for x in width:
			var a := Vector3(x, heights[z * stride + x], z)
			var b := Vector3(x + 1, heights[z * stride + x + 1], z)
			var c := Vector3(x, heights[(z + 1) * stride + x], z + 1)
			var d := Vector3(x + 1, heights[(z + 1) * stride + x + 1], z + 1)
			var color: Color = BIOME_COLORS.get(palette[int(biomes[z * width + x])], Color.MAGENTA)
			# a-b-c y b-d-c: horario visto desde arriba (Three usa a-c-b y b-c-d).
			for triangle: Array in [[a, b, c], [b, d, c]]:
				var normal: Vector3 = (triangle[2] - triangle[0]).cross(triangle[1] - triangle[0]).normalized()
				for vertex: Vector3 in triangle:
					vertices[i] = vertex
					normals[i] = normal
					colors[i] = color
					i += 1

	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.vertex_color_is_srgb = true
	material.roughness = 0.95

	var node := MeshInstance3D.new()
	node.name = "Terrain"
	node.mesh = _array_mesh(vertices, normals, colors)
	node.material_override = material
	return node


func _build_water(cells: Array) -> MeshInstance3D:
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	for cell: Array in cells:
		var x: float = cell[0]
		var z: float = cell[1]
		var y: float = cell[2]
		var a := Vector3(x, y, z)
		var b := Vector3(x + 1, y, z)
		var c := Vector3(x, y, z + 1)
		var d := Vector3(x + 1, y, z + 1)
		vertices.append_array(PackedVector3Array([a, b, c, b, d, c]))
	normals.resize(vertices.size())
	normals.fill(Vector3.UP)

	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.23, 0.56, 0.77, 0.65)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.roughness = 0.3

	var node := MeshInstance3D.new()
	node.name = "Water"
	node.mesh = _array_mesh(vertices, normals, PackedColorArray())
	node.material_override = material
	return node


func _array_mesh(
	vertices: PackedVector3Array,
	normals: PackedVector3Array,
	colors: PackedColorArray,
) -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	if not colors.is_empty():
		arrays[Mesh.ARRAY_COLOR] = colors
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


func _build_props(props: Array) -> void:
	var by_asset := {}
	for prop: Dictionary in props:
		by_asset.get_or_add(prop["asset"], []).append(prop)

	for asset: String in by_asset:
		var instances: Array = by_asset[asset]
		var multimesh := MultiMesh.new()
		multimesh.transform_format = MultiMesh.TRANSFORM_3D
		multimesh.mesh = asset_meshes.get(asset, _placeholder_mesh())
		multimesh.instance_count = instances.size()
		for i in instances.size():
			var prop: Dictionary = instances[i]
			var position_data: Array = prop["position"]
			var origin := Vector3(position_data[0], position_data[1], position_data[2])
			var scale_value: float = prop["scale"]
			var basis := Basis(Vector3.UP, prop["rotationY"]).scaled(Vector3.ONE * scale_value)
			multimesh.set_instance_transform(i, Transform3D(basis, origin))

		var node := MultiMeshInstance3D.new()
		node.name = asset.validate_node_name()
		node.multimesh = multimesh
		add_child(node)


func _placeholder_mesh() -> Mesh:
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	return box
