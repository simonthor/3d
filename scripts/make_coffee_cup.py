import trimesh
import numpy as np

def color_mesh(m, color):
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

CUP_WHITE = [245, 245, 240, 255]
COFFEE_BROWN = [70, 42, 24, 255]
SAUCER_WHITE = [235, 235, 230, 255]

parts = []
SECTIONS = 8  # low-poly facet count

# --- Saucer (flat wide cylinder) ---
saucer = trimesh.creation.cylinder(radius=0.62, height=0.05, sections=SECTIONS)
saucer.apply_translation((0, 0, 0.025))
color_mesh(saucer, SAUCER_WHITE)
parts.append(saucer)

# --- Cup body: tapered cylinder built from a two-ring custom mesh
#     (narrower base, wider rim) so it reads as a mug rather than a can ---
base_r, top_r, cup_h = 0.34, 0.4, 0.55
cup_base_z = 0.05

theta = np.linspace(0, 2 * np.pi, SECTIONS, endpoint=False)
bottom_ring = np.stack([base_r * np.cos(theta), base_r * np.sin(theta), np.full(SECTIONS, cup_base_z)], axis=1)
top_ring = np.stack([top_r * np.cos(theta), top_r * np.sin(theta), np.full(SECTIONS, cup_base_z + cup_h)], axis=1)
bottom_center = np.array([[0, 0, cup_base_z]])
top_center = np.array([[0, 0, cup_base_z + cup_h]])

verts = np.vstack([bottom_ring, top_ring, bottom_center, top_center])
bc_idx = 2 * SECTIONS
tc_idx = 2 * SECTIONS + 1

faces = []
for i in range(SECTIONS):
    ni = (i + 1) % SECTIONS
    # side wall (two tris per quad)
    faces.append([i, ni, SECTIONS + ni])
    faces.append([i, SECTIONS + ni, SECTIONS + i])
    # bottom cap
    faces.append([bc_idx, ni, i])
    # NOTE: top intentionally left open (no cap) so the cup reads as
    # hollow and the coffee disc below is visible through the rim.

cup = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
color_mesh(cup, CUP_WHITE)
parts.append(cup)

# --- Coffee surface: slightly inset disc near the rim ---
coffee_r = top_r * 0.88
coffee_z = cup_base_z + cup_h - 0.03
coffee = trimesh.creation.cylinder(radius=coffee_r, height=0.02, sections=SECTIONS)
coffee.apply_translation((0, 0, coffee_z))
color_mesh(coffee, COFFEE_BROWN)
parts.append(coffee)

# --- Handle: low-poly torus segment on the side of the cup ---
handle_r = 0.16
handle = trimesh.creation.torus(major_radius=handle_r, minor_radius=0.035, major_sections=10, minor_sections=6)
rot = trimesh.transformations.rotation_matrix(np.radians(90), [1, 0, 0])
handle.apply_transform(rot)
handle.apply_translation((top_r * 0.72, 0, cup_base_z + cup_h * 0.55))
color_mesh(handle, CUP_WHITE)
parts.append(handle)

mesh = trimesh.util.concatenate(parts)

bounds = mesh.bounds
mesh.apply_translation((0, 0, -bounds[0][2]))

mesh.export('/home/claude/lowpoly_coffee_cup.glb')
print("Exported. Bounds:", mesh.bounds)
print("Vertices:", len(mesh.vertices), "Faces:", len(mesh.faces))
