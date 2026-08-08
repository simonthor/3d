# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "numpy>=2.5.1",
#     "trimesh>=5.0.0",
# ]
# ///
import trimesh
import numpy as np
from trimesh.visual.material import PBRMaterial

def box(size, translation, color):
    m = trimesh.creation.box(extents=size)
    m.apply_translation(translation)
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

# Colors (RGBA)
SKIN = [222, 184, 158, 255]
SHIRT = [250, 250, 250, 255]
PANTS = [70, 70, 90, 255]       # neutral dark grey pants
SHOE = [30, 30, 30, 255]
HAIR = [90, 65, 50, 255]

parts = []

# --- Proportions (low-poly, blocky, stylized) ---
# Legs
leg_w, leg_d, leg_h = 0.32, 0.32, 1.0
leg_gap = 0.05
parts.append(box((leg_w, leg_d, leg_h), (-(leg_w/2+leg_gap/2), 0, leg_h/2), PANTS))
parts.append(box((leg_w, leg_d, leg_h), ( (leg_w/2+leg_gap/2), 0, leg_h/2), PANTS))

# Shoes
shoe_h = 0.14
parts.append(box((leg_w+0.06, leg_d+0.18, shoe_h), (-(leg_w/2+leg_gap/2), 0.06, shoe_h/2), SHOE))
parts.append(box((leg_w+0.06, leg_d+0.18, shoe_h), ( (leg_w/2+leg_gap/2), 0.06, shoe_h/2), SHOE))

# Torso (shirt)
torso_w, torso_d, torso_h = 0.78, 0.42, 0.95
torso_z = leg_h + torso_h/2
parts.append(box((torso_w, torso_d, torso_h), (0, 0, torso_z), SHIRT))

# Hips block (slight taper base of torso, part of shirt/pants overlap) - use shirt bottom hem
hem_h = 0.12
parts.append(box((torso_w+0.04, torso_d+0.04, hem_h), (0, 0, leg_h + hem_h/2 - 0.02), SHIRT))

# Arms (short sleeve: shoulder portion blue, forearm+hand skin)
sleeve_w, sleeve_d, sleeve_h = 0.26, 0.26, 0.28
arm_w, arm_d, arm_h = 0.22, 0.22, 0.55
shoulder_z = leg_h + torso_h - 0.15
arm_x = torso_w/2 + arm_w/2 - 0.02

for side in (-1, 1):
    # sleeve (shirt)
    parts.append(box((sleeve_w, sleeve_d, sleeve_h), (side*arm_x, 0, shoulder_z - sleeve_h/2), SHIRT))
    # forearm (skin)
    forearm_z = shoulder_z - sleeve_h - arm_h/2
    parts.append(box((arm_w, arm_d, arm_h), (side*arm_x, 0, forearm_z), SKIN))
    # hand
    hand_size = 0.16
    hand_z = forearm_z - arm_h/2 - hand_size/2
    parts.append(box((hand_size, hand_size, hand_size), (side*arm_x, 0, hand_z), SKIN))

# Neck
neck_w, neck_h = 0.18, 0.12
neck_z = leg_h + torso_h + neck_h/2
parts.append(box((neck_w, neck_w, neck_h), (0, 0, neck_z), SKIN))

# Head
head_size = 0.42
head_z = neck_z + neck_h/2 + head_size/2
parts.append(box((head_size, head_size*0.95, head_size), (0, 0, head_z), SKIN))

# Simple short neutral hair cap (top slab)
hair_h = 0.10
hair_z = head_z + head_size/2 - hair_h/2 + 0.01
parts.append(box((head_size+0.02, head_size*0.95+0.02, hair_h), (0, 0, hair_z), HAIR))

# Eyes (small dark boxes on front face of head, front = -y direction)
EYE = [25, 25, 25, 255]
head_d = head_size * 0.95
eye_size = 0.07
eye_z = head_z + 0.03
eye_x = head_size * 0.22
eye_y = head_d/2 + 0.01  # sits just proud of the face plane (front = +y)
for side in (-1, 1):
    parts.append(box((eye_size, 0.03, eye_size), (side*eye_x, eye_y, eye_z), EYE))

# Combine
mesh = trimesh.util.concatenate(parts)

# Center the model on origin (x,y) and place feet at z=0
bounds = mesh.bounds
mesh.apply_translation((0, 0, -bounds[0][2]))

# Export
mesh.export('../public/3dmodels/stick/lowpoly_person_white.glb')
print("Exported. Bounds:", mesh.bounds)
print("Vertices:", len(mesh.vertices), "Faces:", len(mesh.faces))
