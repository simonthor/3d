# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "numpy>=2.5.1",
#     "trimesh>=5.0.0",
# ]
# ///
import trimesh
import numpy as np

def box(size, translation, color):
    m = trimesh.creation.box(extents=size)
    m.apply_translation(translation)
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

# Neutral LEGO-like rectangular blocks for the school scene:
#   block_tall  -> tall vertical block (school gate / door), 3x
#   block_flat  -> long horizontal block (desks), 3x
COLOR_TALL = [170, 180, 200, 255]   # light steel blue
COLOR_FLAT = [205, 185, 140, 255]   # warm tan

def build(size, color, name):
    m = box(size, (0, 0, size[2] / 2), color)
    # Convert Z-up to Y-up (three.js)
    rot = trimesh.transformations.rotation_matrix(np.radians(-90), [1, 0, 0])
    m.apply_transform(rot)
    bounds = m.bounds
    m.apply_translation((0, -bounds[0][1], 0))
    m.export(f"../public/3dmodels/{name}.glb")
    print(f"Exported {name}.glb  bounds: {[round(v, 3) for v in m.bounds.flatten()]}")

build((0.5, 0.5, 1.8), COLOR_TALL, "block_tall")
build((1.6, 0.3, 0.5), COLOR_FLAT, "block_flat")
