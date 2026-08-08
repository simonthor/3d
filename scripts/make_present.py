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

RED = [190, 30, 40, 255]
GOLD = [212, 175, 55, 255]

parts = []

# --- Box (present body) ---
box_size = 1.0
parts.append(box((box_size, box_size, box_size), (0, 0, box_size/2), RED))

# --- Ribbon bands wrapping around the box (front-back and left-right) ---
ribbon_w = 0.14
pad = 0.01  # sits just proud of the box faces to avoid z-fighting

# Band running along X (wraps over top, front, bottom, back) -> spans Y width
parts.append(box((box_size+pad, ribbon_w, box_size+pad), (0, 0, box_size/2), GOLD))

# Band running along Y (wraps over top, left side, bottom, right side) -> spans X width
parts.append(box((ribbon_w, box_size+pad, box_size+pad), (0, 0, box_size/2), GOLD))

# --- Bow on top: a small knot cube + four loop "wings" (low-poly bow) ---
knot_size = 0.20
knot_z = box_size + knot_size/2 - 0.02
parts.append(box((knot_size, knot_size, knot_size), (0, 0, knot_z), GOLD))

# Bow loops: four angled flattened boxes around the knot
loop_w, loop_d, loop_h = 0.30, 0.14, 0.16
loop_z = box_size + loop_h/2 + 0.03
loop_offset = 0.20

loop_positions = [
    ( loop_offset,  loop_offset, 35),
    (-loop_offset,  loop_offset, -35),
    ( loop_offset, -loop_offset, -35),
    (-loop_offset, -loop_offset, 35),
]

for x, y, angle_deg in loop_positions:
    loop = trimesh.creation.box(extents=(loop_w, loop_d, loop_h))
    angle = np.radians(angle_deg)
    rot = trimesh.transformations.rotation_matrix(angle, [0, 0, 1])
    loop.apply_transform(rot)
    loop.apply_translation((x, y, loop_z))
    loop.visual = trimesh.visual.ColorVisuals(loop, vertex_colors=np.tile(np.array(GOLD, dtype=np.uint8), (len(loop.vertices), 1)))
    parts.append(loop)

# Combine
mesh = trimesh.util.concatenate(parts)

# Center on origin (x,y), base sits at z=0
bounds = mesh.bounds
mesh.apply_translation((0, 0, -bounds[0][2]))

mesh.export('/home/claude/lowpoly_present.glb')
print("Exported. Bounds:", mesh.bounds)
print("Vertices:", len(mesh.vertices), "Faces:", len(mesh.faces))