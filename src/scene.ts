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
  subjectId: string | null;
  targetId: string | null;
}

export interface SceneControllerCallbacks {
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number, z: number, rotY: number) => void;
}

const BOUND = 15;
const MIN_Y = 0;
const MAX_Y = 6;
const ROTATION_SENSITIVITY = 8;
const CLICK_THRESHOLD = 6;

/** Unit vector the person faces in world space (models face -Z at rotY = 0). */
export function facingVector(rotY: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(rotY), 0, -Math.cos(rotY));
}

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const lines = text.split('\n');
  const lineH = 90;
  const pad = 24;
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
  const aspect = W / H;
  const w = 0.55;
  sprite.scale.set(w, w / aspect, 1);
  sprite.position.set(0, 2.85, 0);
  return sprite;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

  private debug: DebugConfig = { enabled: false, subjectId: null, targetId: null };
  private selectedId: string | null = null;
  private rotateMode = false;
  private shiftHeld = false;
  private labelsVisible = true;

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
    this.camera.position.set(0, 9, 12);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const hemi = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 0.35);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(6, 12, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -14;
    dir.shadow.camera.right = 14;
    dir.shadow.camera.top = 14;
    dir.shadow.camera.bottom = -14;
    dir.shadow.camera.far = 40;
    this.scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshLambertMaterial({ color: 0xe9e7e2 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(this.lineGroup);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.target.set(0, 0, 0);
    this.orbit.maxPolarAngle = Math.PI * 0.49;

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

  private getModel(kind: KindId): Promise<THREE.Group> {
    let p = this.modelPromises.get(kind);
    if (!p) {
      const def = MODEL_BY_KIND[kind];
      p = this.loader.loadAsync(modelUrl(def)).then((gltf) => gltf.scene);
      this.modelPromises.set(kind, p);
    }
    return p;
  }

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

  setSelection(id: string | null) {
    this.selectedId = id;
    this.updateSelectionRing();
  }

  setDebug(config: DebugConfig) {
    this.debug = config;
    this.updateDebugLines();
  }

  setRotateMode(on: boolean) {
    this.rotateMode = on;
  }

  setLabelsVisible(on: boolean) {
    this.labelsVisible = on;
    for (const group of this.instances.values()) {
      const sprite = group.userData.labelSprite as THREE.Sprite | undefined;
      if (sprite) sprite.visible = on;
    }
  }

  resetCamera() {
    this.camera.position.set(0, 9, 12);
    this.orbit.target.set(0, 0, 0);
    this.orbit.update();
  }

  getCameraState() {
    return { pos: this.camera.position.clone(), target: this.orbit.target.clone() };
  }

  setCameraState(pos: THREE.Vector3, target: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.orbit.target.copy(target);
    this.orbit.update();
  }

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
      const def = MODEL_BY_KIND[o.kind];
      if (def.isPerson && def.labelText) {
        group.userData.labelSprite = makeLabelSprite(def.labelText);
        group.userData.labelSprite.visible = this.labelsVisible;
        group.add(group.userData.labelSprite);
      }
      this.scene.add(group);
      this.draggables.push(group);
      this.instances.set(o.id, group);
    }
    this.applyTransform(group, o);
    this.updateSelectionRing();
    this.updateDebugLines();
  }

  private applyTransform(group: THREE.Group, o: SceneObjectData) {
    group.position.set(o.x, o.y, o.z);
    group.userData.rotY = o.rotY;
    group.quaternion.setFromAxisAngle(this.rotateAxis, o.rotY);
  }

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

  private updateDebugLines() {
    while (this.lineGroup.children.length > 0) {
      const child = this.lineGroup.children[0] as THREE.Line;
      this.lineGroup.remove(child);
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
    }
    if (!this.debug.enabled) return;
    const sub = this.debug.subjectId ? this.instances.get(this.debug.subjectId) : null;
    const tgt = this.debug.targetId ? this.instances.get(this.debug.targetId) : null;
    if (!sub || !tgt || sub === tgt) return;

    const p0 = new THREE.Vector3(sub.position.x, 0.03, sub.position.z);
    const facing = facingVector(sub.userData.rotY ?? 0).multiplyScalar(2);
    const p1 = p0.clone().add(facing);
    this.lineGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p0, p1]),
        new THREE.LineBasicMaterial({ color: 0x2266ee }),
      ),
    );

    const p2 = new THREE.Vector3(tgt.position.x, 0.03, tgt.position.z);
    this.lineGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p0, p2]),
        new THREE.LineBasicMaterial({ color: 0x22aa44 }),
      ),
    );
  }

  private onDragStart = (event: { object: THREE.Object3D }) => {
    const group = event.object as THREE.Group;
    const id = group.userData?.id as string | undefined;
    if (!id) return;
    this.dragId = id;
    this.moved = false;
    this.originalY = group.position.y;
    this.dragRotY = group.userData.rotY ?? 0;
    this.orbit.enabled = false;

    if (this.rotateMode || this.lastPointerButton === 2) {
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
        group.position.set(clamp(p.x, -BOUND, BOUND), this.originalY, clamp(p.z, -BOUND, BOUND));
      }
    } else if (this.dragMode === 'free') {
      group.position.set(
        clamp(group.position.x, -BOUND, BOUND),
        clamp(group.position.y, MIN_Y, MAX_Y),
        clamp(group.position.z, -BOUND, BOUND),
      );
    }
    this.updateSelectionRing();
    this.updateDebugLines();
  };

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

  private groundIntersect(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.raycaster.ray.intersectPlane(this.plane, this.intersection)) {
      return this.intersection.clone();
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.lastPointerButton = e.button;
    this.shiftHeld = e.shiftKey;
    this.clickStart = { x: e.clientX, y: e.clientY };
    this.clickObjId = this.pick(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const dx = e.clientX - this.clickStart.x;
    const dy = e.clientY - this.clickStart.y;
    if (Math.hypot(dx, dy) < CLICK_THRESHOLD) {
      this.cb.onSelect(this.clickObjId);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.shiftHeld = e.shiftKey;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.shiftHeld = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.shiftHeld = false;
  };

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

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    if (this.disposed) return;
    this.animateId = requestAnimationFrame(this.animate);
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  };

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
