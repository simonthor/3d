# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "numpy>=2.5.1",
#     "trimesh>=5.0.0",
# ]
# ///
import trimesh
import numpy as np

def color_mesh(m, color):
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

def box(size, translation, color, rotation=None):
    m = trimesh.creation.box(extents=size)
    if rotation is not None:
        m.apply_transform(rotation)
    m.apply_translation(translation)
    return color_mesh(m, color)

def gable_roof(width, depth, height, z0, y0, color, x0=0.0):
    """Triangular-prism roof: gable triangle in the XZ plane, extruded along Y."""
    p1 = (-width / 2, z0)
    p2 = (width / 2, z0)
    p3 = (0, z0 + height)
    tri = [p1, p2, p3]
    front = [(x0 + x, y0, z) for x, z in tri]
    back = [(x0 + x, y0 + depth, z) for x, z in tri]
    verts = np.array(front + back)
    faces = [
        [0, 1, 2], [3, 5, 4],          # front / back triangle caps
        [0, 3, 4], [0, 4, 1],          # base rectangle
        [1, 4, 5], [1, 5, 2],          # right slope
        [2, 5, 3], [2, 3, 0],          # left slope
    ]
    m = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    return color_mesh(m, color)

# --- Palette ---
WALL = [225, 213, 185, 255]        # cream / beige stucco, common on Japanese school facades
WALL_TRIM = [245, 243, 235, 255]   # white banding
ROOF = [72, 84, 98, 255]           # dark blue-grey roof
WIN_FRAME = [250, 250, 248, 255]
WIN_GLASS = [138, 190, 214, 255]
DOOR = [70, 46, 30, 255]
CLOCK_RIM = [25, 25, 25, 255]
CLOCK_FACE = [250, 250, 245, 255]
CLOCK_HAND = [20, 20, 20, 255]
POLE = [160, 160, 160, 255]
STEP = [200, 197, 190, 255]
BASE_TRIM = [190, 180, 155, 255]

parts = []

# ============ Main building block (3 floors) ============
W, D, H = 7.2, 1.8, 2.1          # width, depth, height
floors = 3
floor_h = H / floors

parts.append(box((W, D, H), (0, D / 2, H / 2), WALL))

# base skirt (slightly darker trim band at ground level)
skirt_h = 0.12
parts.append(box((W + 0.04, D + 0.04, skirt_h), (0, D / 2, skirt_h / 2), BASE_TRIM))

# thin white banding between floors
for f in range(1, floors):
    z = f * floor_h
    parts.append(box((W + 0.02, D + 0.02, 0.05), (0, D / 2, z), WALL_TRIM))

# flat overhanging roof slab on top of the main block
roof_h = 0.15
parts.append(box((W + 0.35, D + 0.35, roof_h), (0, D / 2, H + roof_h / 2), ROOF))
# thin fascia trim just under the roof slab
parts.append(box((W + 0.05, D + 0.05, 0.06), (0, D / 2, H - 0.02), WALL_TRIM))

# ============ Entrance block (protrudes forward, gabled roof + clock) ============
Went, Dent, Hent = 1.7, 0.9, H
parts.append(box((Went, Dent, Hent), (0, -Dent / 2, Hent / 2), WALL))

# entrance skirt
parts.append(box((Went + 0.04, Dent + 0.04, skirt_h), (0, -Dent / 2, skirt_h / 2), BASE_TRIM))

# entrance gable roof
gable_h = 0.55
parts.append(gable_roof(Went + 0.25, Dent + 0.15, gable_h, H, -Dent - 0.075, ROOF))
# small fascia trim strip below the gable
parts.append(box((Went + 0.06, Dent + 0.06, 0.06), (0, -Dent / 2, H - 0.02), WALL_TRIM))

# entrance door (double door, dark)
door_w, door_h = 0.9, 0.9
parts.append(box((door_w, 0.06, door_h), (0, -Dent - 0.02, door_h / 2), DOOR))
# door divider mullion
parts.append(box((0.03, 0.07, door_h), (0, -Dent - 0.025, door_h / 2), WALL_TRIM))

# entry steps
for i, sw in enumerate([1.6, 1.3, 1.0]):
    sh = 0.08
    parts.append(box((sw, 0.22, sh), (0, -Dent - 0.22 - i * 0.22, sh / 2 + i * 0.0), STEP))

# ============ Clock on the entrance facade (below the roofline) ============
clock_r = 0.24
clock_y = -Dent - 0.02
clock_z = H - 0.45  # sits on the flat wall, clear of the gable roof above
rot_face_out = trimesh.transformations.rotation_matrix(np.radians(90), [1, 0, 0])

rim = trimesh.creation.cylinder(radius=clock_r, height=0.035, sections=16)
rim.apply_transform(rot_face_out)
rim.apply_translation((0, clock_y, clock_z))
color_mesh(rim, CLOCK_RIM)
parts.append(rim)

face = trimesh.creation.cylinder(radius=clock_r - 0.035, height=0.02, sections=16)
face.apply_transform(rot_face_out)
face.apply_translation((0, clock_y - 0.012, clock_z))
color_mesh(face, CLOCK_FACE)
parts.append(face)

# clock hands (simple thin boxes), pointing to ~10:10
hour_hand = box((0.03, 0.02, 0.12), (0, clock_y - 0.03, clock_z + 0.03), CLOCK_HAND)
hour_hand.apply_transform(trimesh.transformations.rotation_matrix(np.radians(-30), [0, 1, 0], point=(0, clock_y, clock_z)))
parts[-1] = parts[-1]
parts.append(hour_hand)

minute_hand = box((0.02, 0.02, 0.18), (0, clock_y - 0.03, clock_z + 0.04), CLOCK_HAND)
minute_hand.apply_transform(trimesh.transformations.rotation_matrix(np.radians(60), [0, 1, 0], point=(0, clock_y, clock_z)))
parts.append(minute_hand)

# ============ Windows across the main facade ============
win_w, win_h = 0.46, 0.42
frame_pad = 0.06

def add_window(x, z):
    parts.append(box((win_w + frame_pad, 0.04, win_h + frame_pad), (x, -0.02, z), WIN_FRAME))
    parts.append(box((win_w, 0.03, win_h), (x, -0.03, z), WIN_GLASS))

n_per_side = 3
margin = 0.35
left_start, left_end = -W / 2 + margin, -Went / 2 - margin
right_start, right_end = Went / 2 + margin, W / 2 - margin
xs_left = np.linspace(left_start, left_end, n_per_side)
xs_right = np.linspace(right_start, right_end, n_per_side)

for f in range(floors):
    z = f * floor_h + floor_h * 0.55
    for x in list(xs_left) + list(xs_right):
        add_window(x, z)

# ============ Flagpole on the roof ============
pole_h = 0.9
pole = trimesh.creation.cylinder(radius=0.02, height=pole_h, sections=8)
pole.apply_translation((W / 2 - 0.5, D / 2, H + roof_h + pole_h / 2))
color_mesh(pole, POLE)
parts.append(pole)

# small flag (flattened box) near the top of the pole
flag = box((0.28, 0.01, 0.18), (W / 2 - 0.5 + 0.14, D / 2, H + roof_h + pole_h - 0.15), [200, 40, 40, 255])
parts.append(flag)

# ============ Combine & export ============
mesh = trimesh.util.concatenate(parts)

bounds = mesh.bounds
mesh.apply_translation((0, 0, -bounds[0][2]))

# Convert Z-up to Y-up (three.js)
rot = trimesh.transformations.rotation_matrix(np.radians(-90), [1, 0, 0])
mesh.apply_transform(rot)
bounds = mesh.bounds
mesh.apply_translation((0, -bounds[0][1], 0))

mesh.export('../public/3dmodels/lowpoly_school.glb')
print("Exported. Bounds:", mesh.bounds)
print("Vertices:", len(mesh.vertices), "Faces:", len(mesh.faces))
