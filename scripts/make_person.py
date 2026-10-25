# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "numpy>=2.5.1",
#     "scipy",
#     "trimesh>=5.0.0",
# ]
# ///
import trimesh
import numpy as np
from scipy.spatial import ConvexHull

def box(size, translation, color, thickness=1.0):
    m = trimesh.creation.box(extents=(size[0] * thickness, size[1] * thickness, size[2] * thickness))
    m.apply_translation(translation)
    # One vertex per face corner, so the exported normals are the flat face normals.
    m.unmerge_vertices()
    m.vertex_normals = m.face_normals.repeat(3, axis=0)
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

def sphere_dirs(segments):
    """Unit directions from a subdivided cube projected onto the sphere.

    `segments` is even, so the axis directions and the coordinate-plane great
    circles are included; this keeps the flat faces of `rounded_box` exactly flat.
    """
    g = np.linspace(-1, 1, segments + 1)
    u, v = (a.ravel() for a in np.meshgrid(g, g))
    faces = []
    for a, b, c in ((0, 1, 2), (1, 2, 0), (2, 0, 1)):
        for sign in (-1, 1):
            p = np.zeros((len(u), 3))
            p[:, a], p[:, b], p[:, c] = sign, u, v
            faces.append(p)
    d = np.unique(np.vstack(faces), axis=0)
    return d / np.linalg.norm(d, axis=1, keepdims=True)

def rounded_hull(core, radius, color, segments=4, adjust=None, closest=None):
    """Convex hull of spheres of `radius` around the `core` points (the core shape inflated by `radius`).

    Every hull vertex is a core point plus `radius` times a sphere direction d,
    and d is used as its normal. That is exact when the core points are corners
    (boxes, single points), so the shading is smooth on curved parts and flat on
    flat parts. For a core sampled along a curve (cylinder rings, arcs) d is only
    the nearest sampled direction, which looks banded; pass `closest`, mapping
    points to the nearest point of the solid core shape, to use the exact normal
    instead. `adjust` optionally maps the sample (points, normals) to new ones
    before the hull is taken, e.g. to cut a sphere down to a cap.
    """
    d = sphere_dirs(segments)
    core = np.atleast_2d(np.asarray(core, dtype=float))
    points = (core[:, None, :] + radius * d[None]).reshape(-1, 3)
    normals = np.tile(d, (len(core), 1))
    if adjust is not None:
        points, normals = adjust(points, normals)
    hull = ConvexHull(points)
    used, faces = np.unique(hull.simplices, return_inverse=True)
    normals = normals[used]
    if closest is not None:
        normals = points[used] - closest(points[used])
        normals /= np.linalg.norm(normals, axis=1, keepdims=True)
    faces = faces.reshape(-1, 3)
    tri = points[used][faces]
    flip = np.einsum("ij,ij->i", np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), hull.equations[:, :3]) < 0
    faces[flip] = faces[flip][:, ::-1]
    m = trimesh.Trimesh(points[used], faces, vertex_normals=normals, process=False)
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

def rounded_box(size, translation, color, radius):
    inner = np.array(size, dtype=float) / 2 - radius
    corners = [np.array(translation) + inner * (sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    return rounded_hull(corners, radius, color, segments=4)

def cylinder(radius, z0, z1, xy, color, edge=0.03, sections=24):
    """Vertical cylinder from z0 to z1 at (x, y) = `xy`, with edges rounded by `edge`."""
    t = np.linspace(0, 2 * np.pi, sections, endpoint=False)
    ring = np.column_stack([xy[0] + (radius - edge) * np.cos(t), xy[1] + (radius - edge) * np.sin(t)])
    core = [(x, y, z) for z in (z0 + edge, z1 - edge) for x, y in ring]

    def closest(p):
        rel = p[:, :2] - xy
        scale = np.minimum(1, (radius - edge) / np.maximum(np.linalg.norm(rel, axis=1), 1e-9))
        return np.column_stack([xy + rel * scale[:, None], np.clip(p[:, 2], z0 + edge, z1 - edge)])

    return rounded_hull(core, edge, color, segments=2, closest=closest)

def sphere(radius, center, color, segments=8, cut=None):
    """Sphere; with cut=(n, h) only the cap n . (p - center) >= h is kept.

    Sample points below the plane are moved onto the circle where the plane
    meets the sphere, so the rim of the cap lies exactly in the plane.
    """
    adjust = None
    if cut is not None:
        n = np.asarray(cut[0], dtype=float)
        h = cut[1] / np.linalg.norm(n)
        n = n / np.linalg.norm(n)

        def adjust(points, normals):
            rel = points - center
            below = rel @ n < h
            side = rel[below] - np.outer(rel[below] @ n, n)
            side = side[np.linalg.norm(side, axis=1) > 1e-9]
            rim = h * n + np.sqrt(radius**2 - h**2) * side / np.linalg.norm(side, axis=1, keepdims=True)
            return np.vstack([points[~below], center + rim]), np.vstack([normals[~below], rim / radius])

    return rounded_hull([center], radius, color, segments, adjust)

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
        # Odd number of columns, so the stripes (odd columns) are symmetric about the centre
        n = 7
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
        # 3x3 squares in a band around the chest, clear of the shirt's top and bottom
        cell = 0.1
        for dz in (-0.2, 0, 0.2):
            for c in range(3):
                x = -torso_w / 2 + (c + 0.5) * (torso_w / 3)
                parts.append(box((cell, cell_d, cell), (x, y, torso_z + dz), pattern_color))
    elif pattern == "diag":
        # 45 degree stripes u - v = k (u across, v up the panel), each clipped to the
        # panel rectangle: the clipped stripe is the convex hull of the panel corners
        # inside the stripe and the points where the stripe edges cross the panel edges.
        hw, hh = torso_w / 2, torso_h * 0.85 / 2
        period, stripe_w = 0.2, 0.1
        for k in np.arange(-hw - hh, hw + hh, period):
            pts = [(u, v) for u in (-hw, hw) for v in (-hh, hh) if abs(u - v - k) <= stripe_w / 2]
            for e in (k - stripe_w / 2, k + stripe_w / 2):
                pts += [(u, u - e) for u in (-hw, hw) if abs(u - e) <= hh]
                pts += [(v + e, v) for v in (-hh, hh) if abs(v + e) <= hw]
            if len(set(pts)) < 3:
                continue
            prism = [(u, y + dy, torso_z + v) for u, v in pts for dy in (-cell_d / 2, cell_d / 2)]
            m = trimesh.convex.convex_hull(prism)
            m.unmerge_vertices()
            m.vertex_normals = m.face_normals.repeat(3, axis=0)
            m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(pattern_color, dtype=np.uint8), (len(m.vertices), 1)))
            parts.append(m)
    elif pattern == "check":
        cols, rows = 4, 5
        cw = torso_w / cols
        ch = torso_h * 0.82 / rows
        for r in range(rows):
            for c in range(cols):
                if (r + c) % 2 == 1:
                    x = -torso_w / 2 + (c + 0.5) * cw
                    z = torso_z - torso_h * 0.41 + (r + 0.5) * ch
                    parts.append(box((cw - 0.015, cell_d, ch - 0.02), (x, y, z), pattern_color))
    return parts

def build_person(shirt, pattern, pattern_color, hat_color):
    parts = []

    # Legs (cylinders)
    leg_r, leg_h = 0.16, 1.0
    leg_x = leg_r + 0.025
    for side in (-1, 1):
        parts.append(cylinder(leg_r, 0.05, leg_h + 0.05, (side * leg_x, 0), PANTS))

    # Shoes
    shoe_h = 0.14
    for side in (-1, 1):
        parts.append(rounded_box((2 * leg_r + 0.06, 2 * leg_r + 0.18, shoe_h), (side * leg_x, 0.06, shoe_h / 2), SHOE, 0.06))

    # Torso (shirt) - rounded block, flat front/back for the pattern
    torso_w, torso_d, torso_h = 0.78, 0.42, 0.95
    torso_z = leg_h + torso_h / 2
    torso_r = 0.12
    parts.append(rounded_box((torso_w, torso_d, torso_h), (0, 0, torso_z), shirt, torso_r))

    # Hips block (slight taper base of torso)
    hem_h = 0.12
    parts.append(rounded_box((torso_w + 0.04, torso_d + 0.04, hem_h), (0, 0, leg_h + hem_h / 2 - 0.02), shirt, 0.05))

    # Pattern tiles on both the front (+y, where the eyes are) and the back (-y)
    # of the torso, so people are distinguishable even when facing away.
    # The pattern is kept to the flat part of the front/back faces, inside the rounded edges.
    if pattern is not None:
        cell_d = 0.02
        pattern_w = torso_w - 2 * torso_r + 0.06
        parts.extend(pattern_parts(pattern, pattern_color, pattern_w, torso_d, torso_h, torso_z, cell_d, +1))
        parts.extend(pattern_parts(pattern, pattern_color, pattern_w, torso_d, torso_h, torso_z, cell_d, -1))

    # Arms: shoulder is a quarter cylinder (axis front-back) with rounded edges,
    # rounding the top outer corner of the torso; forearm cylinder and sphere hand below.
    shoulder_R, shoulder_edge = 0.36, 0.04
    shoulder_x = 0.25
    shoulder_z = leg_h + torso_h - 0.02 - shoulder_R
    arm_r, arm_x = 0.11, 0.48
    arc_R = shoulder_R - shoulder_edge
    t = np.linspace(0, np.pi / 2, 12)
    arc = [(shoulder_x + arc_R * np.cos(a), shoulder_z + arc_R * np.sin(a)) for a in t]
    hand_r = 0.13
    hand_z = 0.92
    for side in (-1, 1):
        y = torso_d / 2 - 0.04 - shoulder_edge
        core = [(side * x, sy * y, z) for sy in (-1, 1) for x, z in arc + [(shoulder_x, shoulder_z)]]

        def closest(p, side=side, y=y):
            # Nearest point of the core: the quarter disc (in x-z) times [-y, y].
            x, z = side * p[:, 0] - shoulder_x, p[:, 2] - shoulder_z
            a = np.clip(np.arctan2(z, x), 0, np.pi / 2)
            r = np.minimum(np.hypot(x, z), arc_R)
            qx, qz = r * np.cos(a), r * np.sin(a)
            qx, qz = np.where(z < 0, np.clip(x, 0, arc_R), qx), np.where(z < 0, 0, qz)
            qx, qz = np.where(x < 0, 0, qx), np.where(x < 0, np.clip(z, 0, arc_R), qz)
            return np.column_stack([side * (qx + shoulder_x), np.clip(p[:, 1], -y, y), qz + shoulder_z])

        parts.append(rounded_hull(core, shoulder_edge, shirt, segments=2, closest=closest))
        parts.append(cylinder(arm_r, hand_z, shoulder_z + 0.05, (side * arm_x, 0), SKIN))
        parts.append(sphere(hand_r, (side * arm_x, 0, hand_z), SKIN, segments=6))

    # Neck
    neck_r, neck_h = 0.09, 0.14
    neck_z0 = leg_h + torso_h - 0.04
    parts.append(cylinder(neck_r, neck_z0, neck_z0 + neck_h, (0, 0), SKIN))

    # Head (sphere)
    head_r = 0.25
    head_z = neck_z0 + neck_h + head_r - 0.08
    parts.append(sphere(head_r, (0, 0, head_z), SKIN, segments=10))

    # Hair: cap of a slightly larger sphere, reaching lower at the back (-y) than the front
    hair_r = head_r + 0.02
    parts.append(sphere(hair_r, (0, 0, head_z), HAIR, segments=10,
                        cut=((0, -0.09 / hair_r, 1), -0.01)))

    # Hat (optional): cap dome over the hair and a flat visor sticking out only
    # at the front (a half ellipse starting inside the dome). The dome is a half
    # ellipsoid whose widest point is its rim, so the sides go straight down to
    # the rim, which is horizontal, just above the eyes and level with the
    # visor's underside.
    if hat_color is not None:
        brim_t = 0.017
        brim_z, brim_y0, brim_w, brim_l = head_z + 0.09, 0.12, 0.21, 0.29
        dome = sphere(1, (0, 0, 0), hat_color, segments=10, cut=((0, 0, 1), 0))
        scale = np.array([head_r + 0.025, head_r + 0.025, 0.22])
        normals = dome.vertex_normals / scale
        dome = trimesh.Trimesh(dome.vertices * scale + (0, 0, brim_z - brim_t), dome.faces,
                               vertex_normals=normals / np.linalg.norm(normals, axis=1, keepdims=True), process=False)
        dome.visual = trimesh.visual.ColorVisuals(dome, vertex_colors=np.tile(np.array(hat_color, dtype=np.uint8), (len(dome.vertices), 1)))
        parts.append(dome)
        brim = [(brim_w * np.cos(a), brim_y0 + brim_l * np.sin(a), brim_z) for a in np.linspace(0, np.pi, 16)]
        parts.append(rounded_hull(brim, brim_t, hat_color, segments=2))

    # Eyes (small dark spheres on the front of the head, front = +y direction)
    eye_r = 0.04
    for side in (-1, 1):
        d = np.array([side * 0.36, 1, 0.12])
        parts.append(sphere(eye_r, np.array((0, 0, head_z)) + (head_r - 0.015) * d / np.linalg.norm(d), EYE, segments=4))

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
    mesh.export(f"../public/3dmodels/{name}.glb", include_normals=True)
    print(f"Exported {name}.glb  bounds: {[round(v, 3) for v in mesh.bounds.flatten()]}  verts: {len(mesh.vertices)} faces: {len(mesh.faces)}")
