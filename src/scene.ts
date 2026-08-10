import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MODEL_BY_KIND, modelUrl } from './models';
import type { KindId } from './models';

export interface SceneObjectData {
  id: string;
  kind: KindId;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface DebugConfig {
  enabled: boolean;
}

export interface SceneControllerCallbacks {
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number, z: number, rotY: number) => void;
  onViewChange?: () => void;
}

const BOUND = 15;
const MIN_Y = 0;
const MAX_Y = 3;
const CAMERA_DEFAULT = { pos: [0, 2.3, 12] as const, target: [0, 1.8, 0] as const };
const ROTATION_SENSITIVITY = 8;
const CLICK_THRESHOLD = 6;

/**
 * Unit vector the person faces in world space (models face -Z at rotY = 0).
 * @param rotY Rotation about the Y axis in radians.
 * @returns The normalized facing direction.
 */
function facingVector(rotY: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(rotY), 0, -Math.cos(rotY));
}

/**
 * Renders `text` (newline-separated lines) onto a canvas sprite, used for the
 * chest labels above people models.
 * @param text The label text to draw.
 * @returns A sprite showing the text above the person.
 */
function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const lines = text.split('\n');
  const lineH = 160;
  const pad = 32;
  const W = 640;
  const H = pad * 2 + lineH * lines.length;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    ctx.font = `bold ${lineH}px system-ui, sans-serif`;
    ctx.fillText(ln, W / 2, pad + i * lineH + lineH / 2);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.userData.text = text;
  const aspect = W / H;
  const w = 1.;
  sprite.scale.set(w, w / aspect, 1);
  sprite.position.set(0, 3., 0);
  return sprite;
}

/** Clamps `v` into the inclusive range [lo, hi]. */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Clamps a position to stay within a horizontal disc of radius `r` around the
 * origin, leaving the y component untouched.
 * @param x The x coordinate.
 * @param y The y coordinate (passed through unchanged).
 * @param z The z coordinate.
 * @param r The maximum radial distance from the origin.
 * @returns A new vector with the y passed through and (x, z) inside the disc.
 */
function clampRadial(x: number, y: number, z: number, r: number): THREE.Vector3 {
  const len = Math.hypot(x, z);
  if (len <= r || len === 0) return new THREE.Vector3(x, y, z);
  const s = r / len;
  return new THREE.Vector3(x * s, y, z * s);
}

/**
 * Owns the three.js scene: renderer, camera, lights, ground, orbit/drag
 * controls, model instances and the selection ring. React state is reconciled
 * into the scene through `setObjects()`, and user interactions flow back via
 * the callbacks passed to the constructor.
 */
export class SceneController {
  private container: HTMLElement;
  private cb: SceneControllerCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orbit: OrbitControls;
  private drag: DragControls;
  private ro: ResizeObserver;
  private loader = new GLTFLoader();
  private modelPromises = new Map<KindId, Promise<THREE.Group>>();
  private instances = new Map<string, THREE.Group>();
  private draggables: THREE.Group[] = [];
  private selectionRing: THREE.Mesh | null = null;
  private lineGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane();
  private intersection = new THREE.Vector3();
  private mouse = new THREE.Vector2();

  private debug: DebugConfig = { enabled: false };
  private selectedId: string | null = null;
  private shiftHeld = false;
  private labelsVisible = true;
  private labelTexts = new Map<KindId, string>();

  private dragId: string | null = null;
  private dragMode: 'none' | 'ground' | 'free' | 'rotate' = 'none';
  private moved = false;
  private originalY = 0;
  private rotateStartPos = new THREE.Vector3();
  private dragOffset = new THREE.Vector3();
  private lastPointerX = 0;
  private lastPointerButton = 0;
  private rotateAxis = new THREE.Vector3(0, 1, 0);
  private rotMatrix = new THREE.Matrix4();
  private dragRotY = 0;

  private clickStart = { x: 0, y: 0 };
  private clickObjId: string | null = null;

  private animateId = 0;
  private disposed = false;

  /**
   * Sets up the renderer, camera, lights, ground and controls inside
   * `container`, preloads all model GLBs, and starts the animation loop.
   * @param container The DOM element the 3D stage is mounted into.
   * @param cb Callbacks for selection, move and camera-change events.
   */
  constructor(container: HTMLElement, cb: SceneControllerCallbacks) {
    this.container = container;
    this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2f1ee);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 1;

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200);
    this.camera.position.set(...CAMERA_DEFAULT.pos);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const hemi = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 0.35);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(6, 12, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -16;
    dir.shadow.camera.right = 16;
    dir.shadow.camera.top = 16;
    dir.shadow.camera.bottom = -16;
    dir.shadow.camera.far = 40;
    this.scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(BOUND, 64),
      new THREE.MeshLambertMaterial({ color: 0xe9e7e2 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(this.lineGroup);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.target.set(...CAMERA_DEFAULT.target);
    this.orbit.maxPolarAngle = Math.PI * 0.49;
    this.orbit.addEventListener('change', () => {
      if (this.debug.enabled) this.updateDebugLines();
      this.cb.onViewChange?.();
    });

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.drag = new DragControls(this.draggables, this.camera, this.renderer.domElement);
    this.drag.transformGroup = true;
    this.drag.rotateSpeed = 0;
    this.drag.addEventListener('dragstart', this.onDragStart);
    this.drag.addEventListener('drag', this.onDrag);
    this.drag.addEventListener('dragend', this.onDragEnd);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    for (const def of Object.values(MODEL_BY_KIND)) {
      void this.getModel(def.kind);
    }

    this.animate();
  }

  /**
   * Returns a memoized promise of the loaded GLTF scene root for `kind`.
   * @param kind The kind whose model URL to load.
   */
  private getModel(kind: KindId): Promise<THREE.Group> {
    let p = this.modelPromises.get(kind);
    if (!p) {
      const def = MODEL_BY_KIND[kind];
      p = this.loader.loadAsync(modelUrl(def)).then((gltf) => gltf.scene);
      this.modelPromises.set(kind, p);
    }
    return p;
  }

  /**
   * Reconciles the scene instances to match `list`, adding, removing and
   * repositioning objects as needed.
   * @param list The desired scene objects.
   */
  setObjects(list: SceneObjectData[]) {
    const ids = new Set(list.map((o) => o.id));
    for (const id of Array.from(this.instances.keys())) {
      if (!ids.has(id)) this.removeInstance(id);
    }
    for (const o of list) {
      const group = this.instances.get(o.id);
      if (group) {
        this.applyTransform(group, o);
      } else {
        void this.ensureInstance(o);
      }
    }
    this.updateSelectionRing();
    this.updateDebugLines();
  }

  /**
   * Selects (or clears) an object by id and shows its selection ring.
   * @param id The object id to select, or null to deselect.
   */
  setSelection(id: string | null) {
    this.selectedId = id;
    this.updateSelectionRing();
  }

  /**
   * Toggles the debug visualization lines (camera heading and person facing vectors).
   * @param config Whether debug mode is enabled.
   */
  setDebug(config: DebugConfig) {
    this.debug = config;
    this.updateDebugLines();
  }

  /**
   * Shows or hides all label sprites.
   * @param on True to show labels.
   */
  setLabelsVisible(on: boolean) {
    this.labelsVisible = on;
    for (const group of this.instances.values()) {
      const sprite = group.userData.labelSprite as THREE.Sprite | undefined;
      if (sprite) sprite.visible = on;
    }
  }

  /**
   * Replaces the label text per kind and rebuilds existing label sprites.
   * @param texts Map of kind id to label text (only person kinds are drawn).
   */
  setLabelTexts(texts: Record<string, string>) {
    this.labelTexts = new Map(Object.entries(texts) as [string, string][]);
    for (const group of this.instances.values()) {
      this.rebuildLabelSprite(group);
    }
  }

  /** Resets the camera position and orbit target to their defaults. */
  resetCamera() {
    this.camera.position.set(...CAMERA_DEFAULT.pos);
    this.orbit.target.set(...CAMERA_DEFAULT.target);
    this.orbit.update();
  }

  /**
   * @returns Cloned copies of the camera position and orbit target.
   */
  getCameraState() {
    return { pos: this.camera.position.clone(), target: this.orbit.target.clone() };
  }

  /**
   * Moves the camera to `pos` looking at `target`.
   * @param pos The new camera position.
   * @param target The new orbit/look-at target.
   */
  setCameraState(pos: THREE.Vector3, target: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.orbit.target.copy(target);
    this.orbit.update();
  }

  /**
   * Loads the model for `o` (if needed), creates its scene instance and adds
   * it to the draggables.
   * @param o The scene object data to materialize.
   */
  private async ensureInstance(o: SceneObjectData) {
    const root = await this.getModel(o.kind);
    if (this.disposed) return;
    let group = this.instances.get(o.id);
    if (!group) {
      group = new THREE.Group();
      group.userData = { id: o.id, kind: o.kind };
      const clone = root.clone(true);
      clone.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      group.add(clone);
      this.rebuildLabelSprite(group);
      this.scene.add(group);
      this.draggables.push(group);
      this.instances.set(o.id, group);
    }
    this.applyTransform(group, o);
    this.updateSelectionRing();
    this.updateDebugLines();
  }

  /**
   * Rebuilds the person label sprite for `group` using the current label texts.
   * @param group The instance group to attach the label to.
   */
  private rebuildLabelSprite(group: THREE.Group) {
    const kind = group.userData.kind as KindId;
    const old = group.userData.labelSprite as THREE.Sprite | undefined;
    if (old) {
      group.remove(old);
      (old.material as THREE.Material)?.dispose();
      (old.material as THREE.SpriteMaterial)?.map?.dispose();
    }
    const def = MODEL_BY_KIND[kind];
    const text = this.labelTexts.get(kind);
    if (!def.isPerson || !text) {
      group.userData.labelSprite = undefined;
      return;
    }
    const sprite = makeLabelSprite(text);
    sprite.visible = this.labelsVisible;
    group.userData.labelSprite = sprite;
    group.add(sprite);
  }

  /**
   * Positions and orients `group` according to `o`.
   * @param group The instance group to transform.
   * @param o The target position and rotation.
   */
  private applyTransform(group: THREE.Group, o: SceneObjectData) {
    group.position.set(o.x, o.y, o.z);
    group.userData.rotY = o.rotY;
    group.quaternion.setFromAxisAngle(this.rotateAxis, o.rotY);
  }

  /**
   * Removes the instance with `id` from the scene and disposes its GPU resources.
   * @param id The instance id to remove.
   */
  private removeInstance(id: string) {
    const group = this.instances.get(id);
    if (!group) return;
    this.scene.remove(group);
    const idx = this.draggables.indexOf(group);
    if (idx >= 0) this.draggables.splice(idx, 1);
    group.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      }
    });
    this.instances.delete(id);
  }

  /** Recreates the selection ring under the currently selected object. */
  private updateSelectionRing() {
    if (this.selectionRing) {
      this.scene.remove(this.selectionRing);
      this.selectionRing.geometry.dispose();
      (this.selectionRing.material as THREE.Material).dispose();
      this.selectionRing = null;
    }
    if (!this.selectedId) return;
    const group = this.instances.get(this.selectedId);
    if (!group) return;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.75, 40),
      new THREE.MeshBasicMaterial({
        color: 0x2a6df4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(group.position.x, 0.02, group.position.z);
    this.scene.add(ring);
    this.selectionRing = ring;
  }

  /** Redraws the debug lines (camera heading and person facing) when debug mode is on. */
  private updateDebugLines() {
    while (this.lineGroup.children.length > 0) {
      const child = this.lineGroup.children[0] as THREE.Line;
      this.lineGroup.remove(child);
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
    }
    if (!this.debug.enabled) return;

    const camDir = new THREE.Vector3()
      .subVectors(this.orbit.target, this.camera.position)
      .setY(0)
      .normalize()
      .multiplyScalar(20);
    const camStart = new THREE.Vector3(this.camera.position.x, 0.03, this.camera.position.z);
    this.lineGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([camStart, camStart.clone().add(camDir)]),
        new THREE.LineBasicMaterial({ color: 0x22aa44 }),
      ),
    );

    for (const group of this.instances.values()) {
      const kind = group.userData.kind as KindId;
      if (!MODEL_BY_KIND[kind]?.isPerson) continue;
      const p0 = new THREE.Vector3(group.position.x, 0.03, group.position.z);
      const facing = facingVector(group.userData.rotY ?? 0).multiplyScalar(2);
      const p1 = p0.clone().add(facing);
      this.lineGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([p0, p1]),
          new THREE.LineBasicMaterial({ color: 0x2266ee }),
        ),
      );
    }
  }

  /**
   * Begins a drag: picks ground, free or rotate mode based on the input
   * that started the drag.
   * @param event The DragControls dragstart event.
   */
  private onDragStart = (event: { object: THREE.Object3D }) => {
    const group = event.object as THREE.Group;
    const id = group.userData?.id as string | undefined;
    if (!id) return;
    this.dragId = id;
    this.moved = false;
    this.originalY = group.position.y;
    this.dragRotY = group.userData.rotY ?? 0;
    this.orbit.enabled = false;

    if (this.lastPointerButton === 2) {
      this.dragMode = 'rotate';
      this.rotateStartPos.copy(group.position);
      this.lastPointerX = this.mouse.x;
    } else if (this.shiftHeld) {
      this.dragMode = 'free';
    } else {
      this.dragMode = 'ground';
      this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, this.originalY, 0));
      const inter = this.groundIntersect();
      if (inter) this.dragOffset.copy(inter).sub(group.position);
    }
  };

  /** Applies the drag movement: rotation, ground-plane or free (xyz) movement. */
  private onDrag = () => {
    const group = this.instances.get(this.dragId ?? '');
    if (!group) return;
    this.moved = true;
    if (this.dragMode === 'rotate') {
      group.position.copy(this.rotateStartPos);
      const delta = (this.mouse.x - this.lastPointerX) * ROTATION_SENSITIVITY;
      this.lastPointerX = this.mouse.x;
      this.dragRotY += delta;
      // Rotate about the world Y axis by composing a rotation matrix with the
      // object's matrix (same approach as the original two-character demo).
      group.updateMatrix();
      this.rotMatrix.makeRotationAxis(this.rotateAxis, delta);
      this.rotMatrix.multiply(group.matrix);
      group.rotation.setFromRotationMatrix(this.rotMatrix);
    } else if (this.dragMode === 'ground') {
      const inter = this.groundIntersect();
      if (inter) {
        const p = inter.sub(this.dragOffset);
        group.position.copy(clampRadial(p.x, this.originalY, p.z, BOUND));
      }
    } else if (this.dragMode === 'free') {
      group.position.copy(clampRadial(group.position.x, group.position.y, group.position.z, BOUND));
      group.position.y = clamp(group.position.y, MIN_Y, MAX_Y);
    }
    this.updateSelectionRing();
    this.updateDebugLines();
  };

  /** Commits the drag and reports the final transform through the onMove callback. */
  private onDragEnd = () => {
    if (this.dragId && this.moved) {
      const group = this.instances.get(this.dragId);
      if (group) {
        group.userData.rotY = this.dragRotY;
        this.cb.onMove(this.dragId, group.position.x, group.position.y, group.position.z, this.dragRotY);
      }
    }
    this.dragId = null;
    this.dragMode = 'none';
    this.orbit.enabled = true;
  };

  /**
   * Projects the current pointer ray onto the drag plane.
   * @returns The intersection point, or null if the ray is parallel to the plane.
   */
  private groundIntersect(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.raycaster.ray.intersectPlane(this.plane, this.intersection)) {
      return this.intersection.clone();
    }
    return null;
  }

  /** Records the pointer-down button, position and the object under the cursor. */
  private onPointerDown = (e: PointerEvent) => {
    this.lastPointerButton = e.button;
    this.shiftHeld = e.shiftKey;
    this.clickStart = { x: e.clientX, y: e.clientY };
    this.clickObjId = this.pick(e.clientX, e.clientY);
  };

  /** Fires onSelect when a click (no drag movement) ends on an object. */
  private onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const dx = e.clientX - this.clickStart.x;
    const dy = e.clientY - this.clickStart.y;
    if (Math.hypot(dx, dy) < CLICK_THRESHOLD) {
      this.cb.onSelect(this.clickObjId);
    }
  };

  /** Updates the normalized device-coordinate mouse position and shift key state. */
  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.shiftHeld = e.shiftKey;
  };

  /** Tracks the Shift key down for free-drag mode. */
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.shiftHeld = true;
  };

  /** Clears the Shift key state on key-up. */
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.shiftHeld = false;
  };

  /**
   * Raycasts the draggables from a client-space point.
   * @param clientX The client X coordinate.
   * @param clientY The client Y coordinate.
   * @returns The top-most instance id under the point, or null.
   */
  private pick(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.draggables, true);
    if (hits.length === 0) return null;
    let node: THREE.Object3D | null = hits[0].object;
    while (node) {
      const id = node.userData?.id as string | undefined;
      if (typeof id === 'string') return id;
      node = node.parent;
    }
    return null;
  }

  /** Updates the camera aspect ratio and renderer size to match the container. */
  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Animation loop: updates orbit controls and renders the scene each frame. */
  private animate = () => {
    if (this.disposed) return;
    this.animateId = requestAnimationFrame(this.animate);
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  };

  /** Stops the animation loop, removes event listeners and disposes all GPU resources. */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animateId);
    this.orbit.dispose();
    this.drag.dispose();
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      }
    });
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
