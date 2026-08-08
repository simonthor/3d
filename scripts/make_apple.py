import trimesh
import numpy as np

def color_mesh(m, color):
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

RED = [200, 30, 35, 255]
STEM_BROWN = [90, 60, 35, 255]
LEAF_GREEN = [70, 140, 60, 255]

parts = []

# --- Apple body: low-poly icosphere, slightly squashed vertically and
#     pinched at top/bottom to read as an apple silhouette ---
body = trimesh.creation.icosphere(subdivisions=1, radius=0.5)
verts = body.vertices.copy()

# Squash height a bit (apples are wider than tall)
verts[:, 2] *= 0.85

# Pinch top (near stem) and bottom slightly inward for apple shape
z_norm = verts[:, 2] / (0.5 * 0.85)  # -1..1
pinch = 1.0 - 0.12 * np.clip(z_norm, 0, 1) ** 2      # pinch near top
pinch *= 1.0 - 0.08 * np.clip(-z_norm, 0, 1) ** 2    # slight pinch near bottom
verts[:, 0] *= pinch
verts[:, 1] *= pinch

# Small dimple at the very top where the stem sits
top_mask = z_norm > 0.85
verts[top_mask, 2] -= 0.03

body.vertices = verts
color_mesh(body, RED)
parts.append(body)

# --- Stem: thin cylinder poking out the top ---
stem_h = 0.18
stem = trimesh.creation.cylinder(radius=0.025, height=stem_h, sections=6)
stem.apply_translation((0.02, 0, 0.5*0.85 - 0.02 + stem_h/2))
# tilt slightly for a natural look
tilt = trimesh.transformations.rotation_matrix(np.radians(12), [1, 0, 0], point=(0.02, 0, 0.5*0.85 - 0.02))
stem.apply_transform(tilt)
color_mesh(stem, STEM_BROWN)
parts.append(stem)

# --- Leaf: small flattened low-poly shape (a squashed box) near stem base ---
leaf = trimesh.creation.box(extents=(0.22, 0.1, 0.02))
leaf.apply_translation((0.14, 0.02, 0.5*0.85 + 0.05))
rot_z = trimesh.transformations.rotation_matrix(np.radians(25), [0, 0, 1])
rot_x = trimesh.transformations.rotation_matrix(np.radians(20), [1, 0, 0])
leaf.apply_transform(rot_z)
leaf.apply_transform(rot_x)
color_mesh(leaf, LEAF_GREEN)
parts.append(leaf)

mesh = trimesh.util.concatenate(parts)

# Sit on ground plane (z=0) and center on origin
bounds = mesh.bounds
mesh.apply_translation((0, 0, -bounds[0][2]))

mesh.export('/home/claude/lowpoly_apple.glb')
print("Exported. Bounds:", mesh.bounds)
print("Vertices:", len(mesh.vertices), "Faces:", len(mesh.faces))
