import trimesh
import numpy as np

def color_mesh(m, color):
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1)))
    return m

CAKE_TAN = [235, 200, 150, 255]
FILLING_PINK = [235, 150, 170, 255]
FROSTING_WHITE = [255, 250, 245, 255]
STRAWBERRY_RED = [210, 30, 55, 255]
STRAWBERRY_LEAF = [70, 140, 60, 255]

parts = []

def wedge(depth, height, z0, color, x0=0.0, front_x=0.9, back_inset=0.0):
    """
    A triangular-prism 'slice of cake' layer.
    Cross-section (in the X-Z... actually X-Y plane, extruded along Z=height)
    is a right triangle: tall straight back edge, sloped front (hypotenuse) to a point.
    depth  = how far the triangle extends in Y (front-to-back)
    height = thickness of this layer (extruded along Z)
    z0     = base Z of this layer
    """
    # Triangle corners in the XY plane (a right triangle):
    #  back-left (crust corner), back-right... simplified to a 2D triangle:
    #  point A: back-bottom corner (x=0, y=0)
    #  point B: back-top corner (x=0, y=depth)   -> not used, we do point wedge instead
    # Simpler: triangle with two back corners and one front point.
    p_back_a = (0.0, 0.0)
    p_back_b = (0.0, depth)
    p_front = (front_x, depth * 0.5)

    tri2d = np.array([p_back_a, p_back_b, p_front])
    bottom = np.column_stack([tri2d, np.full(3, z0)])
    top = np.column_stack([tri2d, np.full(3, z0 + height)])
    verts = np.vstack([bottom, top])

    faces = [
        [0, 1, 2],        # bottom cap
        [3, 5, 4],        # top cap
        [0, 3, 4], [0, 4, 1],   # back face (0-1 edge)
        [1, 4, 5], [1, 5, 2],   # right-back-to-front face (1-2 edge)
        [2, 5, 3], [2, 3, 0],   # left-back-to-front face (2-0 edge)
    ]
    m = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    color_mesh(m, color)
    return m

depth = 0.9
front_x = 1.0

layer_specs = [
    (0.00, 0.22, CAKE_TAN),
    (0.22, 0.05, FILLING_PINK),
    (0.27, 0.22, CAKE_TAN),
    (0.49, 0.05, FILLING_PINK),
    (0.54, 0.10, FROSTING_WHITE),
]

for z0, h, color in layer_specs:
    parts.append(wedge(depth, h, z0, color, front_x=front_x))

top_z = layer_specs[-1][0] + layer_specs[-1][1]

# --- Strawberry: small low-poly icosphere with a leafy top, sitting near
#     the back (thicker) edge of the slice on top of the frosting ---
berry_r = 0.13
berry_x = 0.18
berry_y = depth * 0.5
berry = trimesh.creation.icosphere(subdivisions=1, radius=berry_r)
bverts = berry.vertices.copy()
bverts[:, 2] *= 1.15  # slightly elongate for strawberry silhouette
# taper bottom to a point
z_norm = bverts[:, 2] / (berry_r * 1.15)
taper = 1.0 - 0.55 * np.clip(-z_norm, 0, 1) ** 1.3
bverts[:, 0] *= taper
bverts[:, 1] *= taper
berry.vertices = bverts
berry.apply_translation((berry_x, berry_y, top_z + berry_r * 1.15 * 0.8))
color_mesh(berry, STRAWBERRY_RED)
parts.append(berry)

# Leaf cluster on top of the strawberry (a few small flattened boxes fanned out)
leaf_center = (berry_x, berry_y, top_z + berry_r * 1.15 * 1.55)
for i, ang in enumerate([0, 72, 144, 216, 288]):
    leaf = trimesh.creation.box(extents=(0.02, 0.11, 0.02))
    leaf.apply_translation((0, 0.05, 0))
    rot_x = trimesh.transformations.rotation_matrix(np.radians(35), [1, 0, 0])
    leaf.apply_transform(rot_x)
    rot_z = trimesh.transformations.rotation_matrix(np.radians(ang), [0, 0, 1])
    leaf.apply_transform(rot_z)
    leaf.apply_translation(leaf_center)
    color_mesh(leaf, STRAWBERRY_LEAF)
    parts.append(leaf)

mesh = trimesh.util.concatenate(parts)

bounds = mesh.bounds
mesh.apply_translation((-bounds[0][0] - (bounds[1][0]-bounds[0][0])/2,
                         -bounds[0][1] - (bounds[1][1]-bounds[0][1])/2,
                         -bounds[0][2]))

# Convert Z-up to Y-up (three.js)
rot = trimesh.transformations.rotation_matrix(np.radians(-90), [1, 0, 0])
mesh.apply_transform(rot)
bounds = mesh.bounds
mesh.apply_translation((0, -bounds[0][1], 0))

mesh.export('../public/3dmodels/lowpoly_cake_slice.glb')
print("Exported. Bounds:", mesh.bounds)
print("Vertices:", len(mesh.vertices), "Faces:", len(mesh.faces))
