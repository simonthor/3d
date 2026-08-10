# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "numpy>=2.5.1",
#     "trimesh>=5.0.0",
# ]
# ///
import trimesh
import numpy as np

def box(size, translation, color, thickness=1.0):
    m = trimesh.creation.box(extents=(size[0] * thickness, size[1] * thickness, size[2] * thickness))
    m.apply_translation(translation)
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

# Colors (RGBA)
SKIN = [222, 184, 158, 255]
PANTS = [70, 70, 90, 255]       # neutral dark grey pants
SHOE = [30, 30, 30, 255]
HAIR = [90, 65, 50, 255]
EYE = [25, 25, 25, 255]

SHIRT_BLUE = [40, 100, 200, 255]
SHIRT_GREEN = [130, 200, 80, 255]
SHIRT_RED = [200, 20, 40, 255]
SHIRT_ORANGE = [200, 100, 40, 255]
SHIRT_WHITE = [250, 250, 250, 255]
SHIRT_PURPLE = [140, 80, 190, 255]

PATTERN_WHITE = [245, 245, 245, 255]
PATTERN_DARK = [35, 45, 75, 255]
PATTERN_RED = [190, 30, 40, 255]

HAT_RED = [190, 40, 40, 255]
HAT_BLUE = [45, 90, 180, 255]
HAT_GREEN = [70, 150, 70, 255]

def pattern_parts(pattern, pattern_color, torso_w, torso_d, torso_h, torso_z, cell_d, side):
    """Builds the pattern tiles on one side of the torso (side=+1 front, -1 back).

    Tiles are thin boxes laid on the given face (normal along +/-y), so the
    pattern is visible on both front and back of the person.
    """
    parts = []
    y = side * (torso_d / 2 + cell_d / 2)
    if pattern == "stripes":
        n = 6
        cw = torso_w / n
        for i in range(n):
            if i % 2 == 1:
                x = -torso_w / 2 + cw * (i + 0.5)
                parts.append(box((cw - 0.01, cell_d, torso_h * 0.82), (x, y, torso_z), pattern_color))
    elif pattern == "horiz":
        n = 5
        ch = torso_h * 0.82 / n
        for i in range(n):
            if i % 2 == 1:
                z = torso_z - torso_h * 0.41 + ch * (i + 0.5)
                parts.append(box((torso_w - 0.01, cell_d, ch), (0, y, z), pattern_color))
    elif pattern == "polka":
        cols, rows = 3, 4
        cell = 0.1
        for r in range(rows):
            for c in range(cols):
                x = -torso_w / 2 + (c + 0.5) * (torso_w / cols)
                z = torso_z - torso_h / 2 + (r + 0.5) * (torso_h * 0.9 / rows) + 0.05
                parts.append(box((cell, cell_d, cell), (x, y, z), pattern_color))
    elif pattern == "diag":
        cols, rows = 6, 5
        cw = torso_w / cols
        ch = torso_h * 0.85 / rows
        for r in range(rows):
            for c in range(cols):
                if (r + c) % 3 < 2:
                    x = -torso_w / 2 + (c + 0.5) * cw
                    z = torso_z - torso_h * 0.85 / 2 + (r + 0.5) * ch
                    parts.append(box((cw - 0.015, cell_d, ch - 0.02), (x, y, z), pattern_color))
    elif pattern == "check":
        cols, rows = 4, 3
        cw = torso_w / cols
        ch = torso_h / rows
        for r in range(rows):
            for c in range(cols):
                if (r + c) % 2 == 1:
                    x = -torso_w / 2 + (c + 0.5) * cw
                    z = torso_z - torso_h / 2 + (r + 0.5) * ch
                    parts.append(box((cw - 0.015, cell_d, ch - 0.02), (x, y, z), pattern_color))
    return parts

def build_person(shirt, pattern, pattern_color, hat_color):
    parts = []

    # Legs
    leg_w, leg_d, leg_h = 0.32, 0.32, 1.0
    leg_gap = 0.05
    parts.append(box((leg_w, leg_d, leg_h), (-(leg_w / 2 + leg_gap / 2), 0, leg_h / 2), PANTS))
    parts.append(box((leg_w, leg_d, leg_h), ((leg_w / 2 + leg_gap / 2), 0, leg_h / 2), PANTS))

    # Shoes
    shoe_h = 0.14
    parts.append(box((leg_w + 0.06, leg_d + 0.18, shoe_h), (-(leg_w / 2 + leg_gap / 2), 0.06, shoe_h / 2), SHOE))
    parts.append(box((leg_w + 0.06, leg_d + 0.18, shoe_h), ((leg_w / 2 + leg_gap / 2), 0.06, shoe_h / 2), SHOE))

    # Torso (shirt) - base block
    torso_w, torso_d, torso_h = 0.78, 0.42, 0.95
    torso_z = leg_h + torso_h / 2
    parts.append(box((torso_w, torso_d, torso_h), (0, 0, torso_z), shirt))

    # Hips block (slight taper base of torso)
    hem_h = 0.12
    parts.append(box((torso_w + 0.04, torso_d + 0.04, hem_h), (0, 0, leg_h + hem_h / 2 - 0.02), shirt))

    # Pattern tiles on both the front (+y, where the eyes are) and the back (-y)
    # of the torso, so people are distinguishable even when facing away.
    if pattern is not None:
        cell_d = 0.02
        parts.extend(pattern_parts(pattern, pattern_color, torso_w, torso_d, torso_h, torso_z, cell_d, +1))
        parts.extend(pattern_parts(pattern, pattern_color, torso_w, torso_d, torso_h, torso_z, cell_d, -1))

    # Arms (short sleeve: shoulder portion shirt, forearm+hand skin)
    sleeve_w, sleeve_d, sleeve_h = 0.26, 0.26, 0.28
    arm_w, arm_d, arm_h = 0.22, 0.22, 0.55
    shoulder_z = leg_h + torso_h - 0.15
    arm_x = torso_w / 2 + arm_w / 2 - 0.02
    for side in (-1, 1):
        parts.append(box((sleeve_w, sleeve_d, sleeve_h), (side * arm_x, 0, shoulder_z - sleeve_h / 2), shirt))
        forearm_z = shoulder_z - sleeve_h - arm_h / 2
        parts.append(box((arm_w, arm_d, arm_h), (side * arm_x, 0, forearm_z), SKIN))
        hand_size = 0.16
        hand_z = forearm_z - arm_h / 2 - hand_size / 2
        parts.append(box((hand_size, hand_size, hand_size), (side * arm_x, 0, hand_z), SKIN))

    # Neck
    neck_w, neck_h = 0.18, 0.12
    neck_z = leg_h + torso_h + neck_h / 2
    parts.append(box((neck_w, neck_w, neck_h), (0, 0, neck_z), SKIN))

    # Head
    head_size = 0.42
    head_z = neck_z + neck_h / 2 + head_size / 2
    parts.append(box((head_size, head_size * 0.95, head_size), (0, 0, head_z), SKIN))

    # Hair cap (top slab)
    hair_h = 0.10
    hair_z = head_z + head_size / 2 - hair_h / 2 + 0.01
    parts.append(box((head_size + 0.02, head_size * 0.95 + 0.02, hair_h), (0, 0, hair_z), HAIR))

    # Hat (optional cap with brim) on top of the hair
    if hat_color is not None:
        head_top = head_z + head_size / 2
        cap_h = 0.16
        parts.append(box((head_size + 0.04, head_size * 0.95 + 0.04, cap_h), (0, 0, head_top + 0.02 + cap_h / 2), hat_color))
        brim_h = 0.035
        parts.append(box((head_size + 0.14, 0.24, brim_h), (0, 0.04, head_top - 0.02), hat_color))

    # Eyes (small dark boxes on front face of head, front = +y direction)
    head_d = head_size * 0.95
    eye_size = 0.07
    eye_z = head_z + 0.03
    eye_x = head_size * 0.22
    eye_y = head_d / 2 + 0.01
    for side in (-1, 1):
        parts.append(box((eye_size, 0.03, eye_size), (side * eye_x, eye_y, eye_z), EYE))

    mesh = trimesh.util.concatenate(parts)
    # Center on origin in x, base at z=0 (Z-up authoring)
    bounds = mesh.bounds
    mesh.apply_translation((0, 0, -bounds[0][2]))

    # Convert Z-up to Y-up (three.js): +Z (old up) -> +Y (new up)
    rot = trimesh.transformations.rotation_matrix(np.radians(-90), [1, 0, 0])
    mesh.apply_transform(rot)
    bounds = mesh.bounds
    mesh.apply_translation((0, -bounds[0][1], 0))
    return mesh

PERSONS = [
    ("me", SHIRT_BLUE, None, None, None),
    ("you", SHIRT_GREEN, "diag", PATTERN_DARK, None),
    ("person_a", SHIRT_RED, "stripes", PATTERN_WHITE, HAT_BLUE),
    ("person_b", SHIRT_ORANGE, "polka", PATTERN_DARK, HAT_GREEN),
    ("person_c", SHIRT_WHITE, "check", PATTERN_RED, HAT_RED),
    ("family", SHIRT_PURPLE, "horiz", PATTERN_DARK, None),
]

for name, shirt, pattern, pattern_color, hat_color in PERSONS:
    mesh = build_person(shirt, pattern, pattern_color, hat_color)
    mesh.export(f"../public/3dmodels/{name}.glb")
    print(f"Exported {name}.glb  bounds: {[round(v, 3) for v in mesh.bounds.flatten()]}  verts: {len(mesh.vertices)} faces: {len(mesh.faces)}")
